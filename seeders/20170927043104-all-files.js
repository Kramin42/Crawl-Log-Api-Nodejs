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
    src: 'CAO',
    url: [
      'http://crawl.akrasiac.org',
      {
        milestone: '/milestones',
        game: '/logfile',
      },
      {
        fast: ['-git','20'],
        slow: ['04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19'],
      }
    ]
  },
  {
    src: 'CDO',
    url: [
      'http://crawl.develz.org',
      {
        milestone: '/milestones-',
        game: '/allgames-',
      },
      {
        fast: ['svn','0.20'],
        slow: ['0.03','0.04','0.05','0.06','0.07','0.08','0.09','0.10','0.11','0.12','0.13','0.14','0.15','0.16','0.17','0.18','0.19'],
      }
    ]
  },
  {
    src: 'CUE',
    url: [
      'http://underhound.eu:81/crawl/meta/',
      {
        fast: ['git','0.20'],
        slow: ['0.10','0.11','0.12','0.13','0.14','0.15','0.16','0.17','0.18','0.19'],
      },
      {
        milestone: '/milestones',
        game: '/logfile',
      }
    ]
  },
  {
    src: 'CWZ',
    url: [
      'http://webzook.net/soup/',
      {
        fast: ['trunk','0.20'],
        slow: ['0.13','0.14','0.15','0.16','0.17','0.18','0.19'],
      },
      {
        milestone: '/milestones',
        game: '/logfile',
      }
    ]
  },
  {
    src: 'CBRO',
    url: [
      'http://crawl.berotato.org/crawl/meta/',
      {
        fast: ['git','0.20'],
        slow: ['0.13','0.14','0.15','0.16','0.17','0.18','0.19'],
      },
      {
        milestone: '/milestones',
        game: '/logfile',
      }
    ]
  },
  {
    src: 'CXC',
    url: [
      'http://crawl.xtahua.com/crawl/meta/',
      {
        fast: ['git','0.20'],
        slow: ['0.14','0.15','0.16','0.17','0.18','0.19'],
      },
      {
        milestone: '/milestones',
        game: '/logfile',
      }
    ]
  },
  {
    src: 'LLD',
    url: [
      'http://lazy-life.ddo.jp/mirror/meta/',
      {
        fast: ['trunk','0.20'],
        slow: ['0.14','0.15','0.16','0.17','0.18','0.19'],
      },
      {
        milestone: '/milestones',
        game: '/logfile',
      }
    ]
  },
  {
    src: 'CPO',
    url: [
      'https://crawl.project357.org',
      {
        milestone: '/dcss-milestones-',
        game: '/dcss-logfiles-',
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
  },
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
