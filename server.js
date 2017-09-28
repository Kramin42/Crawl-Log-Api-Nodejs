var http = require('http');
var path = require('path');
var fs   = require( 'mz/fs' )
var shell = require('shelljs')
//var Promise = require("bluebird");
var request = require('request-promise');

var exec = require('child_process').exec
var async = require('async');
var io = require('socket.io');
var express = require('express');

var env       = process.env.NODE_ENV || 'development';
var config    = require(__dirname + '/config/config.json')[env];
var db = require("./models");

var chunk_size = 1024*1024

function main() {
    initDownloader()
    initWeb()
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

            fs.open(filePath, 'r').then(fd => {
                return parseEvents(file, fd, '', 0)
            }).catch(err => {
                console.log(err)
                return Promise.resolve()
            })

            setInterval(() => {console.log(file.url, file.offset)}, 30000)
        }
    })
}

function parseEvents(file, fd, accu) {
    if (accu != '') console.log('ACCU:', accu)
    let stats = fs.fstatSync(fd)
    if (stats.size <= file.offset + accu.length) {
        // wait 0.5 sec and try again
        return wait(500)().then(() => parseEvents(file, fd, accu))
    } else {
        return fs.read(fd, new Buffer(chunk_size), 0, chunk_size, file.offset + accu.length)
            .then(([bytesRead, buffer]) => {
                //console.log(bytesRead, buffer)
                accu += buffer.toString('utf-8', 0, bytesRead)
                let lines = accu.split(/\r?\n/)
                let newAccu = lines.pop()
                return db.sequelize.transaction().then(t => {
                    // now consume all complete lines
                    let ps = []
                    file.offset += accu.length - newAccu.length
                    ps.push(file.save({transaction: t}))
                    for (let line of lines){
                        ps.push(processLine(t, file, line))
                    }
                    return Promise.all(ps)
                        .then(() => t.commit())
                        .then(() => parseEvents(file, fd, newAccu))
                        // in case of some error, rollback
                        .catch(err => {
                            t.rollback()
                            throw err
                        })
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
    let rtime = lineObject['time'] || lineObject['end']
    let date = new Date(`${rtime.slice(0,4)}/${parseInt(rtime.slice(4,6))+1}/${rtime.slice(6,8)} ${rtime.slice(8,10)}:${rtime.slice(10,12)}:${rtime.slice(12,14)}`)
    return db.Event.create({
            type: file.type,
            date: date,
            src: file.src,
            data: JSON.stringify(lineObject)
        }, {transaction: t})
}

function initWeb() {
    var router = express()
    var server = http.createServer(router)
    router.use(express.static(path.resolve(__dirname, 'client')))
    
    server.listen(process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port, process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.host, function(){
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