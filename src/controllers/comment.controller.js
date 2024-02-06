import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
const {Video}=require("../models/video.model")

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    const video =await Video.findById(videoId);
    if(!video){
        // if video doesnt exist delete all its comments irrespective of the user
        await Comment.deleteMany({video:videoId})
        return res.status(404).json(new ApiResponse(404, "Video not found"))
    }

    // now that the video exists i can get the comments of the video by going into the comment db and getting 
    // all the comments which matches the video id
    const comments=await Comment.aggregate([
        {
            $match:{
                video:mongoose.Types.ObjectId(videoId)
            }
        },{
            $lookup:{
                // what am i looking for 
                // so i am looking for the user who has commented on the video
                from:"User",
                foreignField:"_id",
                localField:"owner",
                as:"owner"

            }
        },
        // now to find how many likes does the comment have 
        {
            $lookup:{
                from:"Like",
                foreignField:"comment",
                localField:"_id",
                as:"likes"
            }
        },{
            $addFields:{
                likesCount:{
                    $size:"$likes"
                },
                owner:{
                    $first:"$owner"
                },
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$likes.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                },
                isLiked: 1
            },
        },
    ])

})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    // to add comment i would be needing the video id and the user id along with the text of the comment
    try {
        const {videoId}=req.params;
        const {userId}=req.user._id;
        const {text}=req.body;
        if(!videoId || !userId || !text){
            throw new ApiError(400, "Please provide all the required fields")
            
        }
        // need to find the user from the video id from the video db
        const video=await Video.findById(videoId);
        if(!video){
            throw new ApiError(404, "Video not found")
        }
        if(!video.published){
            throw new ApiError(400, "Video is not published")
        }
        const comment=await Comment.create({
            content:text,
            video:mongoose.Types.ObjectId(videoId),//this is the video that i am commenting on 
            owner:mongoose.Types.ObjectId(userId)//this is the data of one of the user which is commenting on the video right !!
        })
        return res.status(200).json( new ApiResponse(201, comment))
    } catch (error) {
        throw new ApiError(500, error.message)
        
    }

})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    // first ask yourself where do you update your comment 
    // i go to a video and in that video i get my already posted comment which i will be updating
    // so i would be needing the video id and the comment id and the user id
    try {
        const {commentId}=req.params;
        const userId=req.user._id.toString();
        const {text}=req.body;
        if( !commentId || !userId || !text){
            throw new ApiError(400, "Please provide all the required fields")
        }
        // first now that i have extracted the things first i need to go to the video and then get the comment and then i will be able to upload 
        // but i can directly go to the comment db and update the specific comment based on the comment id and on validating with the user id 
        // so i would be needing to find the comment first and then update it
        // but if that being updated how would the update be reflected in the video db 
        // but in the videodb also we will be keeping just the id of the comment so when i will be updating the comment from the og place it will be reflected every where 
        const comment=await Comment.findById(commentId);
        if(!comment){
            throw new ApiError(404, "Comment not found")
        }
        // check why did i add new here 
        const videoId = new mongoose.Types.ObjectId(comment.video)
        const video =await Video.findById(videoId);
        // now that i have got the video ..it means that the video is published and as a result i was able to comment 
        // so now i can update the comment and then save it
        // but one thing is that check the video is still existing or not 
        if(!video){
            // if the video doesnt exist it means that the comment should also be deleted
            await Comment.deleteMany({video:videoId})
            return res.status(404).json(new ApiResponse(404, "Video not found"))
        }
        // if i am here that means the video does exist and i can update the comment
        // now lets test credibility of the user whether he can update the comment or not
        // so the owner of the video and teh owner of the comment should be able to update the comment
        if(comment.owner.toString()!==userId){
            throw new ApiError(403, "You are not authorized to update the comment")
        }
        if(video.owner.toString()!==userId){
            throw new ApiError(403, "You are not authorized to update the comment")
        }
        const updatedComment=await Comment.findByIdAndUpdate(commentId,{
            $set:{
                content:text
            }
        },{
            new:true
        })
    
        if(!updatedComment){
            throw new ApiError(500, "Comment could not be updated")
        }
        return res.status(200).json(new ApiResponse(200, updatedComment))
    } catch (error) {
        return res.status(500).json(new ApiResponse(500, error.message))
        
    }


})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }
