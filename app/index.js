var path = require('path'),
  udev = require('udev'),
  monitor = udev.monitor(),
  express = require('express'),
  app = express(),
  http = require('http').Server(app),
  async = require("async"),
  morgan = require('morgan');


var createID = function (device) {
  if (device.hasOwnProperty('syspath')) {
    return device.syspath;
  } else {
    throw {'message': 'this device has no syspath attribute!'};
  }
};


var extendDeviceInfo = function (device, cb) {
  var error = null;
  device.identifier = createID(device);
  device = udev.getNodeDetails(device);
  cb(error, device);
};


var filterSubsystem = function (device) {
  var blackList = [
    'acpi', 'cpu', 'event_source', 'misc', 'thermal', 'pci', 'platform',
    'memory', 'vc', 'pnp', 'mem', 'net', 'block', 'clockevents', 'input',
    'pci_express', 'mei', 'pci_bus', 'watchdog', 'scsi', 'hwmon', 'graphics',
    'ata_port', 'scsi_host', 'block', 'bsg', 'scsi_device', 'scsi_disk',
    'ata_link', 'ata_device', 'serio', 'rtc', 'tpm', 'clocksource',
    'machinecheck', 'node', 'bdi', 'dmi', 'vtconsole', 'workqueue'
  ];
  // only devices represented in /dev that are not blacklisted
  return blackList.indexOf(device.SUBSYSTEM) <= -1 && device.hasOwnProperty('DEVNAME');
};


var filterTTY = function (device) {
  if (device.SUBSYSTEM === 'tty') {
    // accepts only /dev/ttyUSB* and /dev/ttyS*
    return device.DEVNAME.search(/tty(S|USB){1}\d+/) >= 0;
  }
  return true;
};


var listDevice = function (device, cb) {
  cb(
    filterSubsystem(device) &&
    filterTTY(device)
  );
};

var getDeviceList = function (cb) {
  async.filter(udev.list(), listDevice, function (results) {
    async.map(results, extendDeviceInfo, cb)
  })
};


var handleEvent = function (event, device) {
  console.log('EVENTLOGGGER:', event, device);
};


var startMonitoring = function () {
  monitor.on('add', function (device) {
    handleEvent('attach', device);
  });
  monitor.on('remove', function (device) {
    handleEvent('detach', device);
  });
  monitor.on('change', function (device) {
    handleEvent('change', device);
  });
};


var stopMonitoring = function () {
  monitor.close();
};


var main = function () {
  startMonitoring();
  // enable logging
  app.use(morgan('combined'));
  app.get('/', function (req, res, next) {
    getDeviceList(function (err, deviceList) {
      var device, result;
      if (!req.query.hasOwnProperty('identifier')) {
        res.json(deviceList);
      } else {
        async.filter(deviceList, function (item, cb_item) {
          return item && item.identifier === req.query.identifier;
        }, function (results) {
          if (results.length === 0) {
            res.status(404).json({message: 'no such device'});
          } else {
            res.json(results);
          }
          next();
        });
        return;
      }
      next();
    });
  });
  http.listen(process.env.PORT || 3000, function () {
    console.log('listening on: ' + (process.env.PORT || 3000));
  });
};


main();
