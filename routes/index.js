let express = require('express'),
    router = express.Router(),
    mime = require('mime'),
    fs = require('fs'),
    item = require('../model/Item');


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* GET download resource via id */
router.get('/items/resources/download/:itemId/:imageId', function(req, res, next) {
  item.getImageUrl(req.params, function (err, result) {
    if (err){

    } else {
        let filePath = result.url;
        let fileName = req.params.imageId + ".jpg";
        res.download(filePath.substring(1), fileName);
    }
  });
});

/* GET download resource via url */
router.get('/items/resources/download/:url', function(req, res, next) {
    let filePath = req.params.url;
    res.download(req.params.url, 'image.jpg');
});

module.exports = router;
