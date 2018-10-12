/**
 * Created by ahmed on 10/2/2018.
 */
let express = require('express');
let fs = require('fs');
let router = express.Router();
let multer  = require('multer');
let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './resources/categories')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now())
    }
});
let upload = multer({ storage: storage });
let admin = require('../model/Admin');

router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

/* POST create new admin. */
router.post('/add-admin', function(req, res, next) {
    admin.addAdmin(req.body, function (err, result) {
        if (err){
            res.status(400).send(result);
        } else {
            res.status(200).send(result);
        }
    });
});

/* POST create new interest category. */
router.post('/add-interest-category', upload.single('image'), function(req, res, next) {
    let image = req.file;
    let newPath = './resources/categories/'  + image.filename + '.jpg';
    fs.rename(image.path, newPath, function (err) {
        if (err)
            throw err;
        req.body.image_url = newPath;
        admin.addInterest(req.body, function (err, result) {
            if (err){
                res.status(400).send(result);
            } else {
                res.status(200).send(result);
            }
        });
    });
});

module.exports = router;
