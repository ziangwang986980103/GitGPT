import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Define the common fields for both files and directories in a base schema
const baseSchema = new Schema({
    path: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    summary: String
}, { discriminatorKey: 'kind' });

// Extend the base schema for the file schema
const fileSchema = new Schema({});

// Extend the base schema for the directory schema, and add the children field
const directorySchema = new Schema({
    children: [{ type: baseSchema, required: false }]  // The children field is an array of base schema documents
});

// Create models for the base schema, file schema, and directory schema
const Base = mongoose.model('Base', baseSchema);
const File = Base.discriminator('File', fileSchema);
const Directory = Base.discriminator('Directory', directorySchema);

// Export only the Directory model
module.exports = Directory;
