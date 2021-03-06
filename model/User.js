/**
 * Created by ahmed on 10/2/2018.
 */

let mongoose = require('mongoose'),
    sha1 = require('sha1'),
    admin = require('./Admin.js'),
    Schema = mongoose.Schema;
let validatorObj = require('validator');

let userSchema = new Schema({
    name: String,
    email: {
        type:String
    },
    password: String,
    phone: String,
    /*individual - business*/
    userType: {
        type: String,
        default: "individual"
    },
    /*blocked for rate - ongoing*/
    status: {
        type: String,
        default: "ongoing"
    },
    created_at: {
        type: Date,
        default: Date.now()
    }
});

let userInterestsSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    interestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interest'
    }
});

let UserModel = mongoose.model('User', userSchema);
let UserInterestModel = mongoose.model('UserInterest', userInterestsSchema);


module.exports = {
    register: function (data, callback) {
        let user = new UserModel(data);
        let result= {};
        UserModel.find({email: user.email}, function (err, obj) {
            if (obj.length){
                result.error = true;
                result.message = "email already exists";
                callback(true, result);
            } else {
                if (validatorObj.isEmail(user.email)) {
                    user.password = sha1(user.password);
                    user.save(function (err, res) {
                        result.error = false;
                        result.message = "registered successfully";
                        user.password = '';
                        result.user = user;
                        callback(false, result);
                    });
                } else {
                    result.error = true;
                    result.message = "invalid email";
                    callback(true, result)
                }
            }
        });
    },

    login: function (data, callback) {
        UserModel.find({email: data.email, password: sha1(data.password)}, function (err, obj) {
            let result = {};
            if (obj.length){
                result.error = false;
                result.user = obj[0];
                callback(false, result);
            } else {
                result.error = true;
                result.message = 'user not found';
                callback(true, result);
            }
        });
    },

    getUser: function (_id, callback) {
        let result = {};
        UserModel.findById(_id, function (err, obj) {
            if (err){
                result.error = true;
                callback(true, result);
            } else {
                result.error = false;
                result.user = obj;
                callback(false, result);
            }
        });
    },

    getAllInterests: function (callback) {
        admin.getAllInterests(function (err, res) {
            callback(err, res);
        });
    },

    subscribeInterests: function (data, callback) {
        let result = {};
        UserModel.findById(data.userId, function (err, obj) {
            if (err){
                result.error = true;
                result.message = 'user not found';
                callback(true, result);
            } else {
                if (obj.status == 'ongoing'){
                    if (data.interests.length) {
                        data.interests.forEach(function (i) {
                            let newSubscribe = {};
                            newSubscribe.userId = data.userId;
                            newSubscribe.interestId = i;
                            let userInterestModel = new UserInterestModel(newSubscribe);
                            UserInterestModel.find({userId: newSubscribe.userId, interestId: newSubscribe.interestId},
                                 function(err, res){
                                     if(res.length){
                                        result.error = true;
                                        result.message = 'already subscribed';
                                        callback(true, result);
                                     } else {
                                        userInterestModel.save(function (err) {
                                            result.error = false;
                                            result.message = 'added successfully';
                                            callback(false, result);
                                        });
                                     }
                            });
                        });
                    } else {
                        result.error = true;
                        result.message = 'empty body';
                        callback(true, result);
                    }
                } else {
                    result.error = true;
                    result.message = 'this user blocked for rate';
                    callback(true, result);
                }
            }
        });
    },

    getUserInterests: function (data, callback) {
        let result = {};
        UserInterestModel.find({userId: data.userId}, function (err, res) {
                if (err){
                    result.error = true;
                    result.message = 'error occurred';
                    callback(true, result);
                } else if (res.length) {
                    result.error = false;
                    result.interests = res;
                    callback(false, result);
                } else {
                    result.error = true;
                    result.message = 'this user does not have interests';
                    callback(true, result);
                }
            });
    },

    blockUserForRate: function (_id, callback) {
        let result = {};
        UserModel.findById(_id, function (err, obj) {
            if (err){
                result.err = true;
                callback(true, result);
            }  else {
                obj.status = "blocked for rate";
                obj.save(function (err) {
                   if (err){
                       result.err = true;
                       callback(true, result);
                   } else {
                       result.error = false;
                       callback(false, result);
                   }
                });
            }
        });
    },

    ongoing: function (_id, callback) {
        let result = {};
        UserModel.findById(_id, function (err, obj) {
            if (err){
                result.err = true;
                callback(true, result);
            }  else {
                obj.status = "ongoing";
                obj.save(function (err) {
                    if (err){
                        result.err = true;
                        callback(true, result);
                    } else {
                        result.error = false;
                        callback(false, result);
                    }
                });
            }
        });
    }
};