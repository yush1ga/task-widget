const { app, Menu, Tray, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const request = require('request');
const uuidv1 = require('uuid/v1');

let settingWindow
let tray

function fetchTodoist() {
  fs.readFile(path.join(process.env["HOME"], '.todoisttoken'), 'utf-8', (err, token) => {
    if (err) {
      createSettingWindow()
      tray.setContextMenu(buildContextMenu([]))
      return
    }
    request({
      url: 'https://todoist.com/api/v8/sync?sync=*&resource_types=["items"]&token=' + token,
      method: 'GET',
      json: true
    }, (error, response, body) => {
      if (error) {
        console.log(error)
        return
      }
      let items = body.items.filter((item) => {
        let today = new Date()
        let y = String(today.getFullYear())
        let m = String(today.getMonth() + 1)
        if (m.length === 1) m = '0' + m
        let d = String(today.getDate())
        if (d.length === 1) m = '0' + d
        today = y + '-' + m + '-' + d
        return item.due !== null && item.due.date === today
      })
        .sort((l, r) => {
          if (l.day_order < r.day_order) {
            return -1;
          } else if (l.day_order > r.day_order) {
            return 1;
          }
          return 0;
        })
        .map((d) => {
          return {
            id: d.id,
            content: d.content,
            state: 'not_completed'

          }
        })
      let set = new Set(items.map((d) => { return d.id }))
      if (items.length) {
        tray.setTitle(items[0].content)
      }
      
      request({
        url: 'https://todoist.com/api/v8/activity/get?event_type=completed&token=' + token,
        method: 'GET',
        json: true
      }, (error, response, body) => {
        if (error) {
          console.log(error)
          return
        }
        let completedEventIn24Hours = [];
        let now = (new Date()).getTime();
        for (let v of body.events) {
          if (now - Date.parse(v.event_date) <= 86400000 && !set.has(v.object_id)) {
            set.add(v.object_id)
            items.push({
              id: v.object_id,
              content: v.extra_data.content,
              state: 'completed'
            })
          }
        }
        tray.setContextMenu(buildContextMenu(items))
      })
    })
  })

}

function completeTask(task_id) {
  fs.readFile(path.join(process.env["HOME"], '.todoisttoken'), 'utf-8', (err, token) => {
    if (err) {
      createSettingWindow()
      return
    }
    let commands = '[{"type": "item_complete", "uuid": "' + uuidv1() + '", "args": {"id": ' + task_id + '}}]'
    request({
      url: 'https://todoist.com/api/v8/sync?token=' + token.replace('\n', '') + '&commands=' + commands,
      method: 'GET',
      json: true
    }, (error, response, body) => {
      // console.log(error)
      // console.log(response)
      // console.log(body)
      fetchTodoist()
    })
  })
}

function uncompleteTask(task_id) {
  fs.readFile(path.join(process.env["HOME"], '.todoisttoken'), 'utf-8', (err, token) => {
    if (err) {
      createSettingWindow()
      return
    }
    let commands = '[{"type": "item_unarchive", "uuid": "' + uuidv1() + '", "args": {"id": ' + task_id + '}}]'
    request({
      url: 'https://todoist.com/api/v8/sync?token=' + token.replace('\n', '') + '&commands=' + commands,
      method: 'GET',
      json: true
    }, (error, response, body) => {
      // console.log(error)
      // console.log(response)
      console.log(body)
      fetchTodoist()
    })
  })
}

function buildContextMenu(items) {
  let menuItems = [
    {
      label: "Sync", click: function () {
        fetchTodoist()
      }
    },
    {
      label: "Setting", click: function () {
        if (settingWindow == null) {
          createSettingWindow()
        } else {
          settingWindow.focus()
        }
      }
    },
    {
      label: "Quit", click: function () {
        app.quit()
      }
    }
  ]
  if (items.length > 0) {
    menuItems.push(
      {
        type: 'separator'
      }
    )
  }
  for (let item of items) {
    if (item.state === 'not_completed') {
      menuItems.push(
        {
          label: '□ ' + item.content,
          click: () => {
            completeTask(item.id)
          }
        }
      )
    } else {
      menuItems.push(
        {
          label: '☑ ' + item.content,
          click: () => {
            uncompleteTask(item.id)
          }
        }
      )
    }
  }
  return Menu.buildFromTemplate(menuItems)
}

function createSettingWindow() {
  settingWindow = new BrowserWindow({
    width: 480,
    height: 320,
    transparent: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true
    }
  })

  settingWindow.loadFile('./views/setting.html')
  settingWindow.on('closed', function () {
    settingWindow = null
  })
}

app.on('ready', function () {
  app.dock.hide()

  // https://www.iconfinder.com/icons/2639910/checkbox_checked_icon
  tray = new Tray((__dirname + "/imgs/icon.png").toString())
  tray.setToolTip(app.getName())
  fetchTodoist()
})