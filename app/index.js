var path = require('path'),
  udev = require('udev'),
  fs = require('fs'),
  monitor = udev.monitor(),
  express = require('express'),
  app = express(),
  http = require('http').Server(app),
  async = require("async"),
  morgan = require('morgan'),
  spawn = require("child_process").spawn;


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
    'acpi',
    'ata_device',
    'ata_link',
    'ata_port',
    'bdi',
    'block',
    'block',
    'bsg',
    'clockevents',
    'clocksource',
    'cpu',
    'dmi',
    'event_source',
    'graphics',
    'hwmon',
    'input',
    'machinecheck',
    'mei',
    'mem',
    'memory',
    'misc',
    'net',
    'node',
    'pci',
    'pci_bus',
    'pci_express',
    'platform',
    'pnp',
    'rtc',
    'scsi',
    'scsi_device',
    'scsi_disk',
    'scsi_host',
    'serio',
    'thermal',
    'tpm',
    'usb',
    'vc',
    'vtconsole',
    'watchdog',
    'workqueue'
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
  app.get('/v1/hardware/list', function (req, res, next) {
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
  app.get('/v1/network/default/ip', function (req, res, next) {
    var iproute = spawn("ip", ["route", "get", "8.8.8.8"], [null, 'pipe', 'pipe']);
    var awk = spawn("awk", ["{print $NF; exit}"], ['pipe', 'pipe', 'pipe']);
    iproute.on('exit', function (code, signal) {
      if (code == 0) {
        iproute.stdout.pipe(awk.stdin);
        awk.on('exit', function (code, signal) {
          if (code == 0) {
            awk.stdout.pipe(res);
          } else awk.stderr.pipe(res.status(404));
        });
      } else iproute.stderr.pipe(res.status(404));
    });
  });
  var sockpath = '/socketdir/hardware.sock';
  http.listen(sockpath, function () {
    fs.chmodSync(sockpath, 0777);
    console.log('listening on: ' + sockpath);
  });
};


main();
