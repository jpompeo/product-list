const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const reviewSchema = require('./review');

const productSchema = new Schema({
  category: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  reviews: [reviewSchema]
});

module.exports = mongoose.model('Product', productSchema);