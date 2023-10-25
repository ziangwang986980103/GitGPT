//not used anymore

import mongoose from "mongoose";

const Schema = mongoose.Schema;

const directoySchema = new Schema({
    name:{
        type:String,
        required:true
    },
    explanation:String
});

const fileSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    explanation: String
});

const dependencySchema = new Schema({}, { strict: false });

const repoSchema = new Schema({
    fullName: {
        type: String,
        required: true,
        unique: true
    },
    summary:String,
    explanation:{
        directories:[directoySchema],
        files:[fileSchema]
    },
    dependency:{
        type:dependencySchema,
        default:{}
    }
});

const Repo = mongoose.model("Repo",repoSchema);
export default Repo;