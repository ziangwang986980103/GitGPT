import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Step 1: Define the schema without the 'children' field
const repoSchema = new Schema({
    path: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['dir', 'file'],
        required: true
    },
    summary: {
        type: String,
        required: true
    },
    // children will be added in the next step
});

// Step 2: Add the 'children' field to the schema
repoSchema.add({ children: [repoSchema] });

// Step 3: Create the model with the fully defined schema
const Repo = mongoose.model('Repo', repoSchema);
export default Repo;