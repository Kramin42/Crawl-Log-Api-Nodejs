'use strict';

let periods = {
  fast: 1,
  slow: 10,
}

let types = {
  milestone: 'milestone',
  game: 'game'
}

let servers = [
  {
    src: 'CPO',
    url: [
      'https://crawl.project357.org',
      {
        milestone: '/dcss-milestones-',
        game: '/dcss-logfile-',
      },
      {
        fast: ['trunk','0.20'],
        slow: ['0.15','0.16','0.17','0.18','0.19'],
      }
    ]
  },
  {
    src: 'CJR',
    url: [
      'https://crawl.jorgrun.rocks/meta/',
      {
        fast: ['git','0.20'],
        slow: ['0.17','0.18','0.19'],
      },
      {
        milestone: '/milestones',
        game: '/logfile',
      }
    ]
  }
]

let db_rows = []

function addrows(baserow, urlList) {
  if (urlList.length === 0) {
    db_rows.push(baserow)
  } else {
    let newUrlList = urlList.slice()
    let urlItem = newUrlList.shift()
    if (typeof urlItem === 'string') {
      let newBaserow = Object.assign({}, baserow)
      newBaserow['url'] += urlItem
      addrows(newBaserow, newUrlList)
    } else {
      for (let key in urlItem) {
        let newBaserow = Object.assign({}, baserow)
        if (key in types) {
          newBaserow['type'] = types[key]
          newBaserow['url'] += urlItem[key]
          addrows(newBaserow, newUrlList)
        } else if (key in periods) {
          newBaserow['period'] = periods[key]
          //console.log(urlItem[key])
          for (let s of urlItem[key]) {
            let newNewBaserow = Object.assign({}, newBaserow)
            newNewBaserow['url'] += s
            addrows(newNewBaserow, newUrlList)
          }
        }
      }
    }
  }
}

for (let s of servers) {
  let baserow = {
    src: s.src,
    url: '',
    offset: 0,
  }
  addrows(baserow, s.url)
}

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('Logfiles', db_rows, {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Logfiles', null, {});
  }
};
