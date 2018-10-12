let express = require('express');
let router = express.Router();
let fs = require('fs');
let multer  = require('multer');
let sha1 = require('sha1');
let user = require('../model/User.js');
let item = require('../model/Item.js');


let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './resources/items')
    },
    filename: function (req, file, cb) {
        cb(null, sha1(file.originalname + Date.now()) + '.jpg');
    }
});
let upload = multer({ storage: storage });



/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

/* POST register user*/
router.post('/register', function(req, res, next) {
        user.register(req.body, function (err, result) {
            if (err){
                res.status(400).send(result);
            } else {
                res.status(200).send(result);
            }
        });
});

/*POST login user*/
router.post('/login', function(req, res, next) {
    user.login(req.body, function (err, result) {
        if (err){
            res.status(400).send(result);
        } else {
            res.status(200).send(result);
        }
    });
});

/*POST create item*/
router.post('/items/add', upload.array('images', 12), function (req, res, next) {
    let images = req.files;
    req.body.image_urls = [];

    images.forEach(function (image) {
        req.body.image_urls.push({url: image.path});
    });

    item.addItem(req.body, function (err, result) {
        if (err){
            res.status(400).send(result);
        } else {
            res.status(200).send(result);
        }
    });
});

/*POST create swap request*/
router.post('/items/ask-swap', function (req, res, next) {
    item.askForSwap(req.body, function (err, result) {
        if (err){
            res.status(400).send(result);
        } else {
            res.status(200).send(result);
        }
    });
});

/*GET get ongoing requests for one user*/
router.get('/items/get-ongoing-request/:userId', function (req, res, next) {
    item.getMyOngoingSwaps(req.params, function (err, result) {
        if (err){
            res.status(400).send(result);
        } else {
            res.status(200).send(result);
        }
    });
});

/*GET get completed swaps for on user*/
router.get('/items/get-completed-request/:userId', function (req, res, next) {
    item.getMyCompletedSwap(req.params, function (err, result) {
        if (err){
            res.status(400).send(result);
        } else {
            res.status(200).send(result);
        }
    });
});


/*GET get rejected swaps for on user*/
router.get('/items/get-rejected-request/:userId', function (req, res, next) {
    item.getMyRejectedSwap(req.params, function (err, result) {
        if (err){
            res.status(400).send(result);
        } else {
            res.status(200).send(result);
        }
    });
});

/*POST respond to request*/
router.post('/items/respond-to-request', function (req, res, next) {
    item.respondToSwapRequest(req.body, function (err, result) {
        if (err){
            res.status(400).send(result);
        } else {
            res.status(200).send(result);
        }
    });
});

/*POST respond to request*/
router.post('/items/rate-swap', function (req, res, next) {
    item.rateSwap(req.body, function (err, result) {
        if (err){
            res.status(400).send(result);
        } else {
            res.status(200).send(result);
        }
    });
});

module.exports = router;
