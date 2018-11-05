/**
 * Created by ahmed on 10/2/2018.
 */
let mongoose = require('mongoose'),
    sha1 = require('sha1'),
    Schema = mongoose.Schema;

let AdminSchema = new Schema({
    username: String,
    password: {
        type: String,
        validate: {
            validator: function (text) {
                return text.toString().length > 12;
            },
            message: 'password must be more than 12 characters'
        }
    },
    created_at:{
        type: Date,
        default: Date.now()
    }
});

let InterestsSchema = new Schema({
    name: String,
    image_url: String,
    weight: Number,
    created_by :{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    created_at :{
        type: Date,
        default: Date.now()
    }
});

let AdminModel = mongoose.model('Admin', AdminSchema);
let InterestsModel = mongoose.model('Interest', InterestsSchema);

module.exports = {
    addAdmin: function (data, callback) {
        let admin = new AdminModel(data);
        let result = {};
        AdminModel.find({username: admin.username}, function (err, obj) {
            if (obj.length){
                result.error = true;
                result.message = 'username already exists';
                callback(true, result);
            } else {
                admin.password = sha1(admin.password);
                admin.save(function (err, res) {
                    if (err){
                        result.error = true;
                        result.message = 'password must be more than 12 characters';
                        callback(true, result);
                    } else {
                        result.error = false;
                        result.message = 'successfully created new admin';
                        admin.password = '';
                        result.admin = admin;
                        callback(false, result);
                    }
                });
            }
        });
    },

    addInterest: function (data, callback) {
        let interest = new InterestsModel(data);
        let result = {};
        InterestsModel.find({name: interest.name}, function (err, obj) {
            if (obj.length){
                result.error = true;
                result.message = "this category already exists";
                callback(true, result);
            } else {
                interest.save(function (err, res) {
                    if (err){
                        result.error = true;
                        result.message = "invalid admin id";
                        callback(true, result);
                    } else {
                        result.error = false;
                        result.message = "category created successfully";
                        result.interest = interest;
                        callback(true, result);
                    }
                });
            }
        });
    },

    getAllInterests: function (callback) {
        let result = {};
        InterestsModel.find({}, function (err, res) {
            if (err){
                result.error = true;
                result.message = 'error occurred';
                callback(true, result);
            } else if (res.length){
                let interests = [];
                res.forEach(function (i) {
                    let item = {};
                    item._id = i._id;
                    item.name = i.name;
                    item.image = 'http://192.168.174.1:3000' +
                        i.image_url.slice(1, i.image_url.length);
                    interests.push(item);
                });

                result.interests = interests;
                result.error = false;
                callback(false, result);
            } else {
                result.error = true;
                result.message = 'no interests available';
                callback(true, result);
            }
        });
    },
};
