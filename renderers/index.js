const {ipcRenderer} = require('electron')
const $ = require('jquery')

ipcRenderer.on('todoist-token', (event, token) => {
    $.ajax({
        url: 'https://todoist.com/api/v8/sync',
        data: {
            token: token,
            sync: '*',
            resource_types: '["items"]'
        }
    }).done( (data) => {
        let items = data.items.filter((item) => {
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
            if(l.day_order < r.day_order) {
                return -1;
            } else if (l.day_order > r.day_order) {
                return 1;
            }
            return 0;
        })
        .map(v => v.content)
        event.sender.send('set-title', items[0])
        $('#task-list').empty()
        for (let item of items) {
            $('#task-list').append('<li>' + item + '</li>')
            console.log(item)
        }
    }).fail( (data) => {
        console.log(data);
    })
})
