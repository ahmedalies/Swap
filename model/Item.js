/**
 * Created by ahmed on 10/5/2018.
 */
let mongoose = require('mongoose'),
    userModel = require('./User.js'),
    Scheduler = require('mongo-scheduler'),
    scheduler = new Scheduler('mongodb://127.0.0.1:27017/swap', {doNotFire: false, pollInterval: 1000}),
    Schema = mongoose.Schema;

let intervals = [];

let itemSchema = new Schema({
    name: String,
    description: String,
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interest'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    image_urls: [
        {
            url: String
        }
    ],
    /*available - **not-available** - blocked - in-review - rejected - swapped*/
    /*
    * -available -> indicates item available for swapping
    * -in-review -> item goes in-review on **admin due to report or 1 week policy or**
    *      republish
    * -blocked -> item blocked by admin due report or 1 week period
    *       without requests or not accepting request
    *
           *       1- blocked for report
           *       2- blocked for 1 week policy without requests
           *       3- blocked for 1 week policy without accepting requests
    * -rejected -> rejected by admin after in-review state
    * -in-swapping -> after accepting request within 24 hours
    * -swapped -> item has been swapped
    * */
    status: {
        type: String,
        default: "available"
    },
    oneWeekMilli: {
        type: Number,
        default: 604800000
    },
    created_at: {
        type: Date,
        default: Date.now()
    }
});

let itemReportSchema = new Schema({
    report: String,
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    created_at: {
        type: Date,
        default: Date.now()
    }
});

let swapRequestSchema = new Schema({
    neededItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item'
    },
    providedItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item'
    },
    needy:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    /* ongoing - accepted - rejected - canceled*/
    /*
    * -ongoing -> swap request is sent to owner - no confirmation yet
    * -accepted -> swap request is accepted by owner
    * -rejected -> swap request is rejected by owner
    * -canceled -> all remain swap requests is canceled by system when needyUser's request to swap is accepted in one swap request(by system -only-)
    * */
    status: {
        type: String,
        default: "ongoing"
    },
    needyRate: {
        type: Number,
        default: 0
    },
    ownerRate: {
        type: Number,
        default: 0
    },
    respond_at: {
        type: Date,
        default: Date.now()
    },
    after24h: {
        type: Date,
        default: Date.now().valueOf() + (24 * 60 * 60 * 1000)
    },
    mill24h: {
        type: Number,
        default: (24 * 60 * 60 * 1000)
    },
    created_at: {
        type: Date,
        default: Date.now()
    }
});

let upAndRunningSwaps = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    running: [
        {
            swapId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'SwapRequest'
            }
        }
    ]
});

let ItemModel = mongoose.model('Item', itemSchema);
let ItemReportModel = mongoose.model('ItemReport', itemReportSchema);
let SwapRequestModel = mongoose.model('SwapRequest', swapRequestSchema);
let RunningSwapsModel = mongoose.model('RunningSwaps', upAndRunningSwaps);

module.exports = {
    addItem: function (data, callback) {
        let item = ItemModel(data);
        item.status = "available";
        let result = {};
        item.save(function (err, res) {
            if (err){
                result.error = true;
                result.message = "error creating item";
                callback(true, result);
            } else {
                result.error = false;
                result.message = "item created successfully";
                result.item = item;
                register1WeekInterval(item._id);
                callback(false, result);
            }
        });
    },

    modifyItem: function (data, callback) {
        let item = ItemModel(data);
        let result = {};
        item.findById(item.id, function (err, obj) {
            if (obj.length){
                obj.name = item.name;
                obj.description = item.category;
                obj.image_urls = item.image_urls;
                obj.status = item.status;
                obj.created_at = Date.now();
                obj.save(function (err) {
                   if (err){
                       result.error = true;
                       result.message = "error modifying item";
                       callback(true, result);
                   } else {
                       result.error = false;
                       result.message = "item modified successfully";
                       result.item = obj;
                       callback(false, result);
                   }
                });
            } else {
                result.error = true;
                result.message = "item not found";
                callback(true, result);
            }
        });
    },

    deleteIyem: function (data, callback) {
        let item = ItemModel(data);
        let result = {};
        item.findById(item.id, function (err, obj) {
            if (obj.length){
                obj.name = item.name;
                obj.description = item.category;
                obj.image_urls = item.image_urls;
                obj.status = "deleted";
                obj.created_at = Date.now();
                obj.save(function (err) {
                    if (err){
                        result.error = true;
                        result.message = "error deleting item";
                        callback(true, result);
                    } else {
                        result.error = false;
                        result.message = "item deleted successfully";
                        callback(false, result);
                    }
                });
            } else {
                result.error = true;
                result.message = "item not found";
                callback(true, result);
            }
        });
    },

    reportItem: function (data, callback) {
        let itemReport = ItemReportModel(data);
        let result = {};
        itemReport.save(function (err, res) {
            if (err){
                result.error = true;
                result.message = "error inserting report";
                callback(true, result);
            } else {
                result.error = false;
                result.message = "item report inserted successfully";
                callback(false, result);
            }
        });
    },

    askForSwap: function (data, callback) {
        let swapRequest = SwapRequestModel(data);
        swapRequest.status = "ongoing";
        let result = {};
        SwapRequestModel.find({neededItem: swapRequest.neededItem, providedItem: swapRequest.providedItem,
            needy: swapRequest.needy, owner: swapRequest.owner}, function (err, obj) {
            if (obj.length){
                result.error = true;
                result.message = "request already ongoing";
                callback(true, result);
            } else {
                ItemModel.findById(swapRequest.neededItem, function (err, obj) {
                    if (err){
                        result.error = true;
                        result.message = "needed item not found";
                        callback(true, result);
                    } else {
                        if (obj.status === "available") {
                            ItemModel.findById(swapRequest.providedItem, function (err, obj) {
                                if (err){
                                    result.error = true;
                                    result.message = "provided item not found";
                                    callback(true, result);
                                } else {
                                    if (obj.status === "available"){
                                        userModel.getUser(swapRequest.needy, function (err, r) {
                                            if (err){
                                                result.error = true;
                                                result.message = "needy user can not be provided right now";
                                                callback(true, result);
                                            } else {
                                                result.needy = r.user;
                                                if (r.user.status === "ongoing"){
                                                    if (r.user.userType === "individual"){
                                                        userModel.getUser(swapRequest.owner, function (err, rr) {
                                                            if (err){
                                                                result.error = true;
                                                                result.message = "owner user can not be provided right now";
                                                                callback(true, result);
                                                            } else {
                                                                if (rr.user.userType === "business"){
                                                                    result.error = true;
                                                                    result.message = "permission denied";
                                                                    callback(true, result);
                                                                } else {
                                                                    if (rr.user.status === "ongoing"){
                                                                        result.owner = rr.user;
                                                                        swapRequest.save(function (err, res) {
                                                                            if (err){
                                                                                result.error = true;
                                                                                result.message = "error inserting request";
                                                                                callback(true, result);
                                                                            } else {
                                                                                result.error = false;
                                                                                result.message = "request inserted successfully";
                                                                                result.status = "ongoing";
                                                                                callback(false, result);
                                                                            }
                                                                        });
                                                                    } else {
                                                                        result.error = true;
                                                                        result.message = "owner of this item is blocked right now";
                                                                        callback(true, result);
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    } else {
                                                        userModel.getUser(swapRequest.owner, function (err, rr) {
                                                            if (err){
                                                                result.error = true;
                                                                result.message = "owner user can not be provided right now";
                                                                callback(true, result);
                                                            } else {
                                                                if (rr.user.status === "ongoing"){
                                                                    result.owner = rr.user;
                                                                    swapRequest.save(function (err, res) {
                                                                        if (err){
                                                                            result.error = true;
                                                                            result.message = "error inserting request";
                                                                            callback(true, result);
                                                                        } else {
                                                                            result.error = false;
                                                                            result.message = "request inserted successfully";
                                                                            result.status = "ongoing";
                                                                            callback(false, result);
                                                                        }
                                                                    });
                                                                } else {
                                                                    result.error = true;
                                                                    result.message = "owner of this item is blocked right now";
                                                                    callback(true, result);
                                                                }
                                                            }
                                                        });
                                                    }
                                                } else {
                                                    result.error = true;
                                                    result.message = "needy user blocked for rate";
                                                    callback(true, result);
                                                }
                                            }
                                        });
                                    } else {
                                        result.error = true;
                                        result.message = "provided item not available";
                                        callback(true, result);
                                    }
                                }
                            });
                        } else {
                            result.error = true;
                            result.message = "needed item not available for swap right now";
                            callback(true, result);
                        }
                    }
                });
            }
        });
    },

    getMyOngoingSwaps: function (data, callback) {
        let result = {};
        SwapRequestModel.find({owner: data.userId, status: "ongoing"})
            .populate('neededItem - providedItem')
            .populate('needy - owner')
            .exec(function (err, obj) {
                if (err){
                    result.error = true;
                    result.message = "internal error";
                    callback(true, result);
                } else if (obj.length) {
                    result.error = false;
                    result.requsts = obj;
                    callback(false, result);
                } else {
                    result.error = true;
                    result.message = "no requests have been found";
                    callback(true, result);
                }
            });
    },
    
    getMyCompletedSwap: function (data, callback) {
        let result = {};
        SwapRequestModel.find({owner: data.userId, status: "accepted"})
            .populate('neededItem - providedItem')
            .populate('needy - owner')
            .exec(function (err, obj) {
                if (err){
                    result.error = true;
                    result.message = "internal error";
                    callback(true, result);
                } else if (obj.length) {
                    result.error = false;
                    result.requsts = obj;
                    callback(false, result);
                } else {
                    result.error = true;
                    result.message = "no requests have been found";
                    callback(true, result);
                }
            });
    },

    getMyRejectedSwap: function (data, callback) {
        let result = {};
        SwapRequestModel.find({owner: data.userId, status: "rejected"})
            .populate('neededItem - providedItem')
            .populate('needy - owner')
            .exec(function (err, obj) {
                if (err){
                    result.error = true;
                    result.message = "internal error";
                    callback(true, result);
                } else if (obj.length) {
                    result.error = false;
                    result.requsts = obj;
                    callback(false, result);
                } else {
                    result.error = true;
                    result.message = "no requests have been found";
                    callback(true, result);
                }
            });
    },
    
    respondToSwapRequest: function (data, callback) {
        let result = {};
        SwapRequestModel.find({_id: data.requestId, owner: data.owner}, function (err, obj) {
            if(obj.length){
                /*accept request*/
                if (obj[0].status === 'ongoing'){
                    if (data.status === "accepted"){
                        RunningSwapsModel.find({userId: data.owner}, function (err, j) {
                            let runningSwapsForOwnerModel = null;
                            if (j.length){
                                j[0].running.push({swapId: data.requestId});
                                runningSwapsForOwnerModel = j[0];
                            } else {
                                let runningForOwner = {
                                    userId: data.owner,
                                    running: [{swapId: data.requestId}]
                                };
                                runningSwapsForOwnerModel = new RunningSwapsModel(runningForOwner);
                            }
                            runningSwapsForOwnerModel.save(function (err) {
                                if (err){
                                    result.error = true;
                                    result.message = "error occurred-1";
                                    callback(true, result);
                                } else {
                                    RunningSwapsModel.find({userId: obj[0].needy}, function (err, r) {
                                        let runningSwapsForNeedyModel = null;
                                        if (r.length){
                                            r[0].running.push({swapId: data.requestId});
                                            runningSwapsForNeedyModel = r[0];
                                        } else {
                                            let runningForNeedy = {
                                                userId: obj[0].needy,
                                                running: [{swapId: data.requestId}]
                                            };
                                            runningSwapsForNeedyModel = new RunningSwapsModel(runningForNeedy);
                                        }
                                        runningSwapsForNeedyModel.save(function (err) {
                                            if (err){
                                                result.error = true;
                                                result.message = "error occurred-2";
                                                callback(true, result);
                                            } else {
                                                obj[0].status = data.status;
                                                obj[0].respond_at = Date.now();
                                                obj[0].after24h = Date.now().valueOf() + (24 * 60 * 60 * 1000);

                                                obj[0].save(function (err) {
                                                    if (err){
                                                        result.error = true;
                                                        result.message = "error adding response";
                                                        callback(true, result);
                                                    } else {
                                                        let intervalName = data.requestId;
                                                        register1DayInterval(intervalName);


                                                        /*
                                                         * -reject all other requests for that item (neededItem)
                                                         * */
                                                        SwapRequestModel.find({neededItem: obj[0].neededItem}, function (err, res) {
                                                            if (res.length){
                                                                res.forEach(function (i) {
                                                                    if (i._id != data.requestId){
                                                                        i.status = 'rejected';
                                                                        i.save(function (error) {

                                                                        });
                                                                    }
                                                                });
                                                            }

                                                            /*
                                                            * -cancel all other requests for that item(providedItem)
                                                            * */
                                                            SwapRequestModel.find({providedItem: obj[0].providedItem}, function (err, r) {
                                                                if (r.length){
                                                                    r.forEach(function (i) {
                                                                        if (i._id != data.requestId){
                                                                            i.status = 'canceled';
                                                                            i.save(function (error) {

                                                                            });
                                                                        }
                                                                    });
                                                                }
                                                            });

                                                            result.error = false;
                                                            result.message = "response added successfully";
                                                            callback(false, result);
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    });
                                }
                            });
                        });
                    } else {
                        /*reject request*/
                        result.error = false;
                        result.message = "response added successfully";
                        callback(false, result);
                    }
                } else {
                    result.error = true;
                    result.message = "can not respond to this item";
                    callback(false, result);
                }
            } else {
                result.error = true;
                result.message = "request not found";
                callback(true, result);
            }
        });
    },

    rateSwap: function (data, callback) {
        let result = {};
        SwapRequestModel.find({_id: data.requestId}, function (err, obj) {
            if (obj.length){
                if (data.userId == obj[0].needy){
                    obj[0].needyRate = data.rate;
                } else if (data.userId == obj[0].owner){
                    obj[0].ownerRate = data.rate;
                } else {
                    result.error = true;
                    result.message = "insufficient userId";
                    callback(true, result);
                    return;
                }
                obj[0].save(function (err) {
                    if (err){
                        result.error = true;
                        result.message = "error occurred";
                        callback(true, result);
                    } else {
                        RunningSwapsModel.find({userId: data.userId}, function (err, j) {
                            if (j.length){
                                j[0].running = j[0].running.filter(function (err, i) {
                                    if (j[0].running[i].swapId != data.requestId){
                                        return j[0].running[i].swapId;
                                    }
                                });

                                j[0].save(function (err) {
                                    if (err){
                                        result.error = true;
                                        result.message = "insufficient requestId-1";
                                        callback(true, result);
                                    } else {
                                        userModel.ongoing(data.userId, function (err, result) {

                                        });
                                        if (intervals[data.requestId] && obj[0].needyRate > 0 && obj[0].ownerRate > 0){
                                            intervals[data.requestId] = null;
                                            clearInterval(intervals[data.requestId.valueOf()]);
                                        }
                                        result.error = false;
                                        result.message = "rated successfully";
                                        callback(false, result);
                                    }
                                });
                            }
                        });
                    }
                });
            } else {
                result.error = true;
                result.message = "insufficient requestId-2";
                callback(true, result);
            }
        });
    },

    onBoot: function () {
        RunningSwapsModel.find({}, function (err, result) {
            if (result.length){
                result.forEach(function (r) {
                    r.running.forEach(function (j) {
                        register1DayInterval(j.swapId);
                    });
                });
            }
        });

        ItemModel.find({}, function (err, result) {
            if (result.length){
                result.forEach(function (r) {
                    if (r.status == "available")
                        register1WeekInterval(r._id);
                });
            }
        })
    },
};

function register1DayInterval(requestId) {
    intervals[requestId.valueOf()] = setInterval(function () {
        SwapRequestModel.find({_id: requestId}, function (err, obj) {
            if (intervals[requestId]) {
                if (obj[0].mill24h >= 1000) {
                    obj[0].mill24h = obj[0].mill24h - 1000;
                } else {
                    obj[0].mill24h = 0;
                    clearInterval(intervals[requestId.valueOf()]);
                    intervals[requestId.valueOf()] = null;
                    if (obj[0].needyRate == 0){
                        userModel.blockUserForRate(obj[0].needy, function (err, result) {

                        });
                    }

                    if (obj[0].ownerRate == 0){
                        userModel.blockUserForRate(obj[0].owner, function (err, result) {

                        });
                    }
                }
                obj[0].save(function (err) {
                    if (err)
                        throw err;
                    else {

                    }
                });
            }
        });
    }, 1000);
}

function register1WeekInterval(itemId) {
    ItemModel.find({_id: itemId}, function (err, result) {
        if (result.length){
            intervals[itemId.valueOf()] = setInterval(function () {
                if (result[0].oneWeekMilli >= 1000){
                    result[0].oneWeekMilli = result[0].oneWeekMilli - 1000;
                } else {
                    result[0].oneWeekMilli = 0;
                    result[0].status = "blocked";
                }

                SwapRequestModel.find({neededItem: itemId}, function (err, obj) {
                    if (obj.length){
                        obj.forEach(function (i) {
                            if (i.status != "ongoing"){
                                if (intervals[itemId.valueOf()]){
                                    clearInterval(intervals[itemId.valueOf()]);
                                }
                            }
                        });
                    } else {
                        result[0].status = "available";
                    }
                });
                result[0].save(function (err) {

                });
            }, 1000);
        }
    });
}