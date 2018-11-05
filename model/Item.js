/**
 * Created by ahmed on 10/5/2018.
 */
let mongoose = require('mongoose'),
    userModel = require('./User.js'),
    Scheduler = require('mongo-scheduler'),
    scheduler = new Scheduler('mongodb://127.0.0.1:27017/swap', {doNotFire: false, pollInterval: 1000}),
    Schema = mongoose.Schema,
    assert = require("assert"),
    timeAgo = require('node-time-ago');

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
    * -processing -> item is in processing mode at that time
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
        userModel.getUser(data.user, function (error, userResult) {
            if (userResult){
                if (userResult.user.status == 'ongoing'){
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
                } else {
                    result.error = true;
                    result.message = "this user blocked for rate";
                    callback(true, result);
                }
            } else {
                result.error = true;
                result.message = "can't find this user";
                callback(true, result);
            }
        });
    },

    /* todo add user policy -blocked for rate -*/
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

    /* todo add user policy -blocked for rate -*/
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

    /* todo add user policy -blocked for rate -*/
    reportItem: function (data, callback) {
        let result = {};
        if (data.report) {
            let itemReport = ItemReportModel(data);
            userModel.getUser(data.user, function (err, userResult) {
                if (userResult.user.status == 'ongoing'){
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
                } else {
                    result.error = true;
                    result.message = "this user blocked for rate";
                    callback(true, result);
                }
            });
        } else {
            result.error = true;
            result.message = "can not report item with no reason";
            callback(true, result);
        }
    },

    getUserItems: function (data, callback) {
        let result = {};
        let items = [];
        ItemModel.find({user: data.userId, status: 'available'}, function (err, res) {
                        if (err){
                            result.error = true;
                            result.message = 'error occurred';
                            callback(true, result);
                        } else if (res.length){
                            let counter = 0;
                            res.forEach(function (i) {
                                counter++;
                                if (i.status == 'available'){
                                    let ii = {};
                                    ii._id = i._id;
                                    ii.status = i.status;
                                    ii.created_at = timeAgo(i.created_at);
                                    ii.name = i.name;
                                    ii.description = i.description;
                                    ii.category = i.category;
                                    if (i.image_urls.length){
                                        let images = [];
                                        i.image_urls.forEach(function (im) {
                                            let image = {};
                                            image._id = im._id;
                                            image.url = im.url;
                                            images.push(image)
                                        });
                                        ii.images = images;
                                    }
                                    items.push(ii);

                                    if (counter == res.length){
                                        if (items.length){
                                            result.error = false;
                                            result.items = items;
                                            callback(false, result);
                                        } else {
                                            result.error = true;
                                            result.message = 'no items found';
                                            callback(true, result);
                                        }
                                    }
                                }
                                else {
                                    if (counter == res.length) {
                                        if (items.length) {
                                            result.error = false;
                                            result.items = items;
                                            callback(false, result);
                                        } else {
                                            result.error = true;
                                            result.message = 'no items found';
                                            callback(true, result);
                                        }
                                    }
                                }
                            });
                        } else {
                            result.error = true;
                            result.message = 'no items found';
                            callback(true, result);
                        }
                    });
    },

    getItemsByCategory: function (data, callback) {
        let result = {};
        let items = [];
        userModel.getUserInterests(data, function (err, r) {
            if (err){
                callback(true, r);
            } else if (r.interests.length) {
                let counter = 0;
                let innerCounter = 0;
                let requestCounter = 0;
                r.interests.forEach(function(x){
                    counter++;
                    ItemModel.find({category: x.interestId, status: 'available'})
                        .populate('user')
                        .exec(function(err, res){
                            if (err){
                                result.error = true;
                                result.message = 'error occurred';
                                callback(true, result);
                                //break;**/
                            } else if (res.length){
                                innerCounter = 0;
                                res.forEach(function (i) {
                                    innerCounter++;
                                    if (i.status == 'available'){
                                        let ii = {};
                                        ii._id = i._id;
                                        ii.status = i.status;
                                        ii.created_at = timeAgo(i.created_at);
                                        ii.name = i.name;
                                        ii.owner = {};
                                        ii.owner.name = i.user.name;
                                        ii.owner._id = i.user._id;
                                        ii.description = i.description;
                                        ii.category = i.category;
                                        if (i.image_urls.length){
                                            let images = [];
                                            i.image_urls.forEach(function (im) {
                                                let image = {};
                                                image._id = im._id;
                                                image.url = im.url.substring(im.url.lastIndexOf('\\') + 1);
                                                images.push(image)
                                            });
                                            ii.images = images;
                                        }

                                        /*get requests sent to me by this item if exist*/
                                        console.log('interest: ' + counter + r.interests.length);
                                        console.log('inner: ' + innerCounter + res.length);
                                        requestCounter = 0;
                                        SwapRequestModel.find({owner: data.userId, providedItem: ii._id, status: "ongoing"})
                                            .populate('needy - owner')
                                            .populate('neededItem - providedItem')
                                            .exec()
                                            .then(function (doc) {
                                                console.log(doc.length + " : " + res.length);
                                                console.log('increase request ' + requestCounter + doc.length);
                                                requestCounter++;

                                                if (doc.length)
                                                    ii.swapRequest = doc[0];
                                                else
                                                    ii.swapRequest = null;

                                                /*the user in request does't have this item*/
                                                if (ii.owner._id != data.userId)
                                                    items.push(ii);

                                                if (requestCounter === doc.length && innerCounter === res.length){

                                                }

                                                if (counter === r.interests.length && innerCounter === res.length
                                                    && requestCounter === innerCounter){
                                                    console.log('error');
                                                    if (items.length){
                                                        result.error = false;
                                                        result.items = items;
                                                        callback(false, result);
                                                    } else {
                                                        result.error = true;
                                                        result.message = 'no available items found';
                                                        callback(true, result);
                                                    }
                                                }
                                            });
                                    }
                                });
                            } else {
                                result.error = true;
                                result.message = 'no items found';
                                callback(true, result);
                                //break;*/
                            }
                        });
                });
            } else {
                callback(true, r);
            }
        });
    },

    getItemDetails: function (data, callback) {
        let result = {};
        ItemModel.find({_id: data.itemId}, function (err, r) {
            if (err){
                result.error = true;
                result.messgae = 'error occurred';
                callback(true, result);
            } else if (r.length){
                if (r[0].status == 'available'){
                    let item = {};
                    item._id = r[0].id;
                    item.status = r[0].status;
                    item.created_at = timeAgo(r[0].created_at);
                    item.name = r[0].name;
                    item.category = r[0].category;
                    item.description = r[0].description;
                    item.owner = r[0].owner;
                    item.images = [];
                    if (r[0].image_urls.length){
                        r[0].image_urls.forEach(function (i) {
                            item.images.push(i.substring(s.lastIndexOf('\\') + 1));
                        });
                    }

                    result.error = false;
                    result.item = item;
                    callback(false, result);
                } else {
                    result.error = true;
                    result.messgae = 'this item not available';
                    callback(true, result);
                }
            } else {
                result.error = true;
                result.messgae = 'item not found';
                callback(true, result);
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
                    .sort('-created_at')
                    .populate('neededItem - providedItem')
                    .populate('needy - owner')
                    .exec(function (err, obj) {
                        if (err){
                            result.error = true;
                            result.message = "internal error getting meOwnerRequests";
                            //callback(true, result);
                        } else if (obj.length) {
                            result.error = false;
                            result.meOwnerRequests = obj;
                            //callback(true, result);
                        } else {
                            result.error = true;
                            result.message = "no requests have been found";
                            //callback(true, result);
                        }

                         SwapRequestModel.find({needy: data.userId, status: "ongoing"})
                                .sort('-created_at')
                                .populate('neededItem - providedItem')
                                .populate('needy - owner')
                                .exec(function (err, obj2) {
                                    if (err){
                                        if (result.meOwnerRequests) {
                                            result.error = false;
                                            result.message = "internal error getting meNeedyRequests";
                                            callback(false, result);
                                        } else {
                                            result.error = true;
                                            result.message = "internal error";
                                            callback(true, result);
                                        }
                                    } else if (obj2.length) {
                                        result.error = false;
                                        result.meNeedyRequests = obj2;
                                        callback(false, result);
                                    } else {
                                        if (result.meOwnerRequests) {
                                            result.error = false;
                                            result.message = "no needy requests have been found";
                                            callback(false, result);
                                        } else {
                                            result.error = true;
                                            result.message = "no requests have been found";
                                            callback(true, result);
                                        }
                                    }
                                });
                    });
    },

    getMyUnratedSwaps: function (data, callback) {
        let result = {};
        SwapRequestModel.find({owner: data.userId, status: "in-swapping", ownerRate: 0})
                    .sort('-created_at')
                    .populate('neededItem - providedItem')
                    .populate('needy - owner')
                    .exec(function (err, obj) {
                        if (err){
                            result.error = true;
                            result.message = "internal error getting meOwnerRequests";
                            //callback(true, result);
                        } else if (obj.length) {
                            result.error = false;
                            result.meOwnerRequests = obj;
                            //callback(true, result);
                        } else {
                            result.error = true;
                            result.message = "no requests have been found";
                            //callback(true, result);
                        }

                         SwapRequestModel.find({needy: data.userId, status: "in-swapping", needyRate: 0})
                                .sort('-created_at')
                                .populate('neededItem - providedItem')
                                .populate('needy - owner')
                                .exec(function (err, obj2) {
                                    if (err){
                                        if (result.meOwnerRequests) {
                                            result.error = false;
                                            result.message = "internal error getting meNeedyRequests";
                                            callback(false, result);
                                        } else {
                                            result.error = true;
                                            result.message = "internal error";
                                            callback(true, result);
                                        }
                                    } else if (obj2.length) {
                                        result.error = false;
                                        result.meNeedyRequests = obj2;
                                        callback(false, result);
                                    } else {
                                        if (result.meOwnerRequests) {
                                            result.error = false;
                                            result.message = "no needy requests have been found";
                                            callback(false, result);
                                        } else {
                                            result.error = true;
                                            result.message = "no requests have been found";
                                            callback(true, result);
                                        }
                                    }
                                });
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
                            //callback(true, result);
                        } else if (obj.length) {
                            result.error = false;
                            result.meOwnerRequests = obj;
                            //callback(false, result);
                        } else {
                            result.error = true;
                            result.message = "no requests have been found";
                            //callback(true, result);
                        }

                        SwapRequestModel.find({needy: data.userId, status: "accepted"})
                                .sort('-created_at')
                                .populate('neededItem - providedItem')
                                .populate('needy - owner')
                                .exec(function (err, obj2) {
                                    if (err){
                                        if (result.meOwnerRequests) {
                                            result.error = false;
                                            result.message = "internal error getting meNeedyRequests";
                                            callback(false, result);
                                        } else {
                                            result.error = true;
                                            result.message = "internal error";
                                            callback(true, result);
                                        }
                                    } else if (obj2.length) {
                                        result.error = false;
                                        result.meNeedyRequests = obj2;
                                        callback(false, result);
                                    } else {
                                        if (result.meOwnerRequests) {
                                            result.error = false;
                                            result.message = "no needy requests have been found";
                                            callback(false, result);
                                        } else {
                                            result.error = true;
                                            result.message = "no requests have been found";
                                            callback(true, result);
                                        }
                                    }
                                });
                    });
    },

    getMyRejectedSwap: function (data, callback) {
        let result = {};
        userModel.getUser(data.userId, function (err, userResult) {
            if (userResult.user.status == 'ongoing'){
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
            } else {
                result.error = true;
                result.message = "this user blocked for rate";
                callback(true, result);
            }
        });
    },
    
    respondToSwapRequest: function (data, callback) {
        let result = {};
        userModel.getUser(data.owner, function (err, userResult) {
            if (userResult.user.status == 'ongoing') {
                SwapRequestModel.find({_id: data.requestId, owner: data.owner}, function (err, obj) {
                    if(obj.length){
                        /*accept request*/
                        if (obj[0].status === 'ongoing') {
                            ItemModel.find({_id: obj[0].providedItem, status: 'available'}, function (ep, rp) {
                                if (rp.length){
                                    ItemModel.find({_id: obj[0].neededItem, status: 'available'}, function (en, rn) {
                                        if (rn.length){
                                            if (data.status === "accepted") {
                                                ItemModel.find({_id: obj[0].neededItem}, function (eee, rrr) {
                                                    rrr[0].status = 'processing';
                                                    rrr[0].save(function (e1) {
                                                        ItemModel.find({_id: obj[0].providedItem}, function (eee, rrrr) {
                                                            rrrr[0].status = 'processing';
                                                            rrrr[0].save(function (e2) {
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
                                                                                        obj[0].status = 'in-swapping';
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
                                                                                                let rejectCounter = 0;
                                                                                                SwapRequestModel.find({neededItem: obj[0].neededItem, status: 'ongoing'}, function (err, res) {
                                                                                                    if (res.length){
                                                                                                        res.forEach(function (i) {
                                                                                                            rejectCounter++;
                                                                                                            if (i._id != data.requestId){
                                                                                                                i.status = 'rejected';
                                                                                                                i.save(function (error) {
                                                                                                                    if (error){
                                                                                                                        console.error("error other swaps rejected")
                                                                                                                    } else {
                                                                                                                        console.log("other swaps rejected");
                                                                                                                    }

                                                                                                                    if (rejectCounter === res.length){
                                                                                                                        /*
                                                                                                                         * -change neededItem status to in-swapping
                                                                                                                         * */
                                                                                                                        ItemModel.find({_id: obj[0].neededItem}, function (err, f) {
                                                                                                                            f[0].status = 'in-swapping';
                                                                                                                            f[0].save(function (err) {
                                                                                                                                if (err){
                                                                                                                                    console.error("error change needed to in-swapping")
                                                                                                                                } else {
                                                                                                                                    console.log("change needed to in-swapping");
                                                                                                                                }
                                                                                                                            });
                                                                                                                        });
                                                                                                                    }
                                                                                                                });
                                                                                                            } else {
                                                                                                                if (rejectCounter === res.length){
                                                                                                                    /*
                                                                                                                     * -change neededItem status to in-swapping
                                                                                                                     * */
                                                                                                                    ItemModel.find({_id: obj[0].neededItem}, function (err, f) {
                                                                                                                        f[0].status = 'in-swapping';
                                                                                                                        f[0].save(function (err) {
                                                                                                                            if (err){
                                                                                                                                console.error("error change needed to in-swapping")
                                                                                                                            } else {
                                                                                                                                console.log("change needed to in-swapping");
                                                                                                                            }
                                                                                                                        });
                                                                                                                    });
                                                                                                                }
                                                                                                            }
                                                                                                        });
                                                                                                    } else {
                                                                                                        /*
                                                                                                         * -change neededItem status to in-swapping
                                                                                                         * */
                                                                                                        ItemModel.find({_id: obj[0].neededItem}, function (err, f) {
                                                                                                            f[0].status = 'in-swapping';
                                                                                                            f[0].save(function (err) {
                                                                                                                if (err){
                                                                                                                    console.error("error change needed to in-swapping")
                                                                                                                } else {
                                                                                                                    console.log("change needed to in-swapping");
                                                                                                                }
                                                                                                            });
                                                                                                        });
                                                                                                    }
                                                                                                });

                                                                                                /*
                                                                                                 * -cancel all other requests for that item(providedItem)
                                                                                                 * */
                                                                                                let canceledCounter = 0;
                                                                                                SwapRequestModel.find({providedItem: obj[0].providedItem, status: 'ongoing'}, function (err, r) {
                                                                                                    if (r.length){
                                                                                                        r.forEach(function (ii) {
                                                                                                            canceledCounter++;
                                                                                                            if (ii._id != data.requestId){
                                                                                                                ii.status = 'canceled';
                                                                                                                ii.save(function (error) {
                                                                                                                    if (error){
                                                                                                                        console.error("error cancel all other requests")
                                                                                                                    } else {
                                                                                                                        console.log("cancel all other requests");
                                                                                                                    }
                                                                                                                });

                                                                                                                if (canceledCounter === r.length){
                                                                                                                    /*
                                                                                                                     * -change providedItem status to in-swapping
                                                                                                                     * */
                                                                                                                    ItemModel.find({_id: obj[0].providedItem}, function (e, c) {
                                                                                                                        c[0].status = 'in-swapping';
                                                                                                                        c[0].save(function (ee) {
                                                                                                                            if (ee){
                                                                                                                                console.error("error changing providedItem status to in-swapping")
                                                                                                                            } else {
                                                                                                                                console.log("change providedItem status to in-swapping");
                                                                                                                            }
                                                                                                                        });
                                                                                                                    });
                                                                                                                }
                                                                                                            } else {
                                                                                                                if (canceledCounter === r.length){
                                                                                                                    /*
                                                                                                                     * -change providedItem status to in-swapping
                                                                                                                     * */
                                                                                                                    ItemModel.find({_id: obj[0].providedItem}, function (e, c) {
                                                                                                                        c[0].status = 'in-swapping';
                                                                                                                        c[0].save(function (ee) {
                                                                                                                            if (ee){
                                                                                                                                console.error("error changing providedItem status to in-swapping")
                                                                                                                            } else {
                                                                                                                                console.log("change providedItem status to in-swapping");
                                                                                                                            }
                                                                                                                        });
                                                                                                                    });
                                                                                                                }
                                                                                                            }
                                                                                                        });
                                                                                                    } else {
                                                                                                        ItemModel.find({_id: obj[0].providedItem}, function (e, c) {
                                                                                                            c[0].status = 'in-swapping';
                                                                                                            c[0].save(function (ee) {
                                                                                                                if (ee){
                                                                                                                    console.error("error changing providedItem status to in-swapping")
                                                                                                                } else {
                                                                                                                    console.log("change providedItem status to in-swapping");
                                                                                                                }
                                                                                                            });
                                                                                                        });
                                                                                                    }
                                                                                                });

                                                                                                result.error = false;
                                                                                                result.message = "response added successfully";
                                                                                                callback(false, result);
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                });
                                                                            });
                                                                        }
                                                                    });
                                                                });
                                                            });
                                                        });
                                                    });
                                                });

                                            } else {
                                                /*reject request*/
                                                console.log('saved');
                                                result.error = false;
                                                result.message = "response added successfully";
                                                callback(false, result);
                                            }
                                        } else {
                                            result.error = true;
                                            result.message = "needed item not available";
                                            callback(false, result);
                                        }
                                    });
                                } else {
                                    result.error = true;
                                    result.message = "provided item not available";
                                    callback(false, result);
                                }
                            });
                        } else {
                            result.error = true;
                            result.message = "can not respond to this request";
                            callback(false, result);
                        }
                    } else {
                        result.error = true;
                        result.message = "request not found";
                        callback(true, result);
                    }
                });
            } else {
                result.error = true;
                result.message = "this user blocked for rate";
                callback(true, result);
            }
        });
    },

    rateSwap: function (data, callback) {
        let result = {};
        SwapRequestModel.find({_id: data.requestId}, function (err, obj) {
            if (obj.length){    
                if (data.userId == obj[0].needy){
                    if (obj[0].needyRate > 0) {
                        result.error = true;
                        result.message = "already rated";
                        callback(true, result);
                        return;
                    } else {
                        obj[0].needyRate = data.rate;
                        ItemModel.find({_id: obj[0].providedItem}, function (err, res) {
                            if (res.length){
                                res[0].status = 'swapped';
                                res[0].save(function (e) {

                                });
                            }
                        });
                    }
                } else if (data.userId == obj[0].owner){
                    if (obj[0].ownerRate > 0) {
                        result.error = true;
                        result.message = "already rated";
                        callback(true, result);
                        return;
                    } else {
                        obj[0].ownerRate = data.rate;
                        ItemModel.find({_id: obj[0].neededItem}, function (err, res) {
                            if (res.length){
                                res[0].status = 'swapped';
                                res[0].save(function (e) {

                                });
                            }
                        });
                    }
                } else {
                    result.error = true;
                    result.message = "insufficient userId";
                    callback(true, result);
                    return;
                }

                if (obj[0].ownerRate > 0 && obj[0].needyRate > 0){
                    obj[0].status = 'accepted';
                }

                obj[0].save(function (err) {
                    if (err){
                        console.log(err);
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
                                        if (j[0].running.length === 0) {
                                            userModel.ongoing(data.userId, function (err, result) {

                                            });
                                        } 
                                    
                                        if (intervals[data.requestId] && obj[0].needyRate > 0 && obj[0].ownerRate > 0){
                                            intervals[data.requestId] = null;
                                            clearInterval(intervals[data.requestId.valueOf()]);
                                            intervals.splice(intervals.indexOf(data.requestId.valueOf()), 1);
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

    getImageUrl: function (data, callback) {
        let result = {};
        ItemModel.find({_id: data.itemId}, function (err, res) {
            if (err){
                result.error = true;
                result.message = "error getting item";
                callback(true, result);
            } else if (res.length) {
                if (res[0].image_urls.length){
                    res[0].image_urls.forEach(function (i) {
                        if (i._id == data.imageId){
                            result.error = false;
                            result.url = i.url;
                            callback(false, result);
                            return;
                        }
                    });
                }
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
                    intervals.splice(intervals.indexOf(requestId.valueOf()), 1);
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
                                    intervals.splice(intervals.indexOf(itemId.valueOf()), 1);
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

/*userModel.getUser(data.userId, function (err, userResult) {
    if (userResult.user.status != 'ongoing'){

    } else {
        result.error = true;
        result.message = "this user blocked for rate";
        callback(true, result);
    }
});*/