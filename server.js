var express = require('express')
var http = require('http')
var path = require('path')
var fs   = require( 'mz/fs' )
var shell = require('shelljs')
var exec = require('child_process').exec

var router = express()
var server = http.createServer(router)
var io = require('socket.io')(server)

var env = process.env.NODE_ENV || 'development';
var config = require(__dirname + '/config/config.json')[env];
var db = require("./models")
var Sequelize = require('sequelize')

var chunk_size = 1024*1024

function main() {
    initWeb()
    initDownloader()
}

function initDownloader() {
    db.Logfile.findAll().then(files => {
        for (let file of files) {
            shell.mkdir('-p', path.resolve(__dirname,'sources',file.src))
            let filePath = path.resolve(__dirname,'sources',file.src,file.url.replace(/\\/g,'').replace(/:/g,'').replace(/\//g,'-'))
            shell.touch(filePath)
            let dlloop = () => {
                let child = exec(`curl -Lf -o ${filePath} -C - ${file.url}`)
                child.on('close', code => {
                    //console.log(`download from ${file.url} finished with code ${code}`)
                    setTimeout(dlloop, file.period*1000)
                })
            }
            dlloop()

            fs.open(filePath, 'r')
                .then(fd => parseEvents(file, fd, '', 0))
                .catch(err => {
                    console.log(err)
                })

            //setInterval(() => {console.log(file.url, file.offset)}, 60000)
        }
    })
}

function parseEvents(file, fd, accu) {
    //console.log('parsing file',file.url)
    //if (accu != '') console.log('ACCU:', accu)
    let stats = fs.fstatSync(fd)
    if (stats.size <= parseInt(file.offset) + accu.length) {
        //console.log(stats.size, '<=', file.offset)
        // wait 0.5 sec and try again
        setTimeout(() => parseEvents(file, fd, accu), 500)
    } else {
        fs.read(fd, new Buffer(chunk_size), 0, chunk_size, parseInt(file.offset) + accu.length)
            .then(([bytesRead, buffer]) => {
                //console.log(bytesRead, buffer)
                accu += buffer.toString('utf-8', 0, bytesRead)
                let lines = accu.split(/\r?\n/)
                //console.log('processing',lines,'lines from',file.url)
                let newAccu = lines.pop()
                return db.sequelize.transaction().then(t => {
                    // now consume all complete lines
                    let ps = []
                    file.offset = parseInt(file.offset) + accu.length - newAccu.length
                    ps.push(file.save({transaction: t}))
                    for (let line of lines){
                        ps.push(processLine(t, file, line))
                    }
                    return Promise.all(ps)
                        .then(() => t.commit())
                        // in case of some error, rollback
                        .catch(err => {
                            t.rollback()
                            console.log(err)
                            console.log(lines)
                            return wait(60000)() // in case the error repeats, dont spam
                        })
                        .then(() => parseEvents(file, fd, newAccu))
                })
            })
    }
}

function processLine(t, file, line) {
    let lineObject = 
        line
        .trim()
        .replace(/::/g,'|COLON|')
        .split(/:/)
        .map(x => x.replace(/\|COLON\|/g,':').split(/=/))
        .reduce(function(prev,curr){prev[curr[0]]=curr[1];return prev;},{})
    if (lineObject['type']==='crash') return Promise.resolve()
    let rtime = lineObject['time'] || lineObject['end']
    let date = new Date(0)
    try {
        date = new Date(`${rtime.slice(0,4)}/${parseInt(rtime.slice(4,6))+1}/${rtime.slice(6,8)} ${rtime.slice(8,10)}:${rtime.slice(10,12)}:${rtime.slice(12,14)}`)
        if (date == 'Invalid Date') date = new Date(0)
    } catch (err) {
        //console.log('Invalid Date')
        date = new Date(0)
    }
    io.emit('crawlevent', JSON.stringify([lineObject]))
    return db.Event.create({
            type: file.type,
            date: date,
            src: file.src,
            data: JSON.stringify(lineObject)
        }, {transaction: t})
}

function initWeb() {
    router.use(express.static(path.resolve(__dirname, 'static')))

    router.get('/event', (req, res) => {
        let q = {
            attributes: [
                'id',
                'type',
                'date',
                'src',
                'data',
            ],
            where: {},
            raw: true,
            offset: 0,
            limit: 1000,
        }
        if ('offset' in req.query)
            q.offset = parseInt(req.query.offset)
        if ('limit' in req.query && req.query.limit <= q.limit)
            q.limit = parseInt(req.query.limit)
        if ('src' in req.query)
            q.where.src = req.query.src.toUpperCase()
        if ('type' in req.query)
            q.where.type = req.query.type
        if ('reverse' in req.query)
            q.order = [['id', 'DESC']]
        db.Event.findAll(q).then(results => {
            results = results.map(x => {
                x.data = JSON.parse(x.data)
                x.time = Math.round(new Date(x.date).getTime()/1000)
                delete x.date
                x.src_abbr = x.src
                delete x.src
                return x
            })
            let response = {
                status: 200,
                message: 'OK',
                offset: q.offset,
                next_offset: q.offset + results.length,
                results: results,
            }
            res.type('application/json')
            res.send(response)
        })
    })

    io.on('connection', () => console.log('socketio client connected'))
    
    server.listen(process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.httpport, process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.httphost, function(){
        var addr = server.address()
        console.log(`Server listening at ${addr.address}:${addr.port}`)
    });
    
    server.on('error', function (err) {
        console.log('Caught server error:', err.stack)
    });
}

function wait(ms) {
  return function(x) {
    return new Promise(resolve => setTimeout(() => resolve(x), ms));
  };
}

main()
