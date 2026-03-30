var express = require('express');
var router = express.Router();
let { checkLogin } = require('../utils/authHandler.js')
let messageModel = require('../schemas/messages')
let userModel = require('../schemas/users')
let mongoose = require('mongoose')

router.get('/:userId', checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;
        let targetUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            res.status(400).send({ message: 'userId khong hop le' })
            return;
        }

        let messages = await messageModel.find({
            $or: [
                { from: currentUserId, to: targetUserId },
                { from: targetUserId, to: currentUserId }
            ]
        })
            .sort({ createdAt: 1 })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl')

        res.send(messages)
    } catch (error) {
        res.status(400).send({ message: error.message })
    }
})

router.post('/', checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;
        let { to, messageContent, filePath } = req.body;

        if (!to || !mongoose.Types.ObjectId.isValid(to)) {
            res.status(400).send({ message: 'to bat buoc va phai la userId hop le' })
            return;
        }

        let receiver = await userModel.findOne({ _id: to, isDeleted: false })
        if (!receiver) {
            res.status(404).send({ message: 'nguoi nhan khong ton tai' })
            return;
        }

        let finalContent = { ...(messageContent || {}) };

        if (filePath) {
            finalContent.type = 'file';
            finalContent.text = filePath;
        }

        if (!finalContent.type && typeof finalContent.text === 'string') {
            finalContent.type = 'text';
        }

        if (!['file', 'text'].includes(finalContent.type)) {
            res.status(400).send({ message: 'messageContent.type chi nhan file hoac text' })
            return;
        }

        if (!finalContent.text || typeof finalContent.text !== 'string') {
            res.status(400).send({ message: 'messageContent.text bat buoc' })
            return;
        }

        let newMessage = new messageModel({
            from: currentUserId,
            to: to,
            messageContent: {
                type: finalContent.type,
                text: finalContent.text
            }
        })

        let result = await newMessage.save();
        result = await result.populate('from', 'username fullName avatarUrl')
        result = await result.populate('to', 'username fullName avatarUrl')

        res.send(result)
    } catch (error) {
        res.status(400).send({ message: error.message })
    }
})

router.get('/', checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;
        let allMessages = await messageModel.find({
            $or: [
                { from: currentUserId },
                { to: currentUserId }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl')

        let latestByUser = {};
        let result = [];

        for (const message of allMessages) {
            let partner = message.from._id.toString() === currentUserId.toString()
                ? message.to
                : message.from;
            let partnerId = partner._id.toString();

            if (!latestByUser[partnerId]) {
                latestByUser[partnerId] = true;
                result.push(message);
            }
        }

        res.send(result)
    } catch (error) {
        res.status(400).send({ message: error.message })
    }
})

module.exports = router;
