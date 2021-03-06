const router = require('express').Router();
const faker = require('faker');
const Product = require('../models/product');

module.exports = function(app) {

  app.get('/api/generate-fake-data', (request, response, next) => {
    for (let i = 0; i < 90; i++) {
      let product = new Product();
  
      product.category = faker.commerce.department();
      product.name = faker.commerce.productName();
      product.price = faker.commerce.price();
      product.image = faker.random.image();
  
      product.save((error) => {
        if (error) throw error;
      })
    }
    response.end();
  });
  
  app.get('/api/products', (request, response, next) => {
    //products to display on each page
    const perPage = 8;
  
    //get queries
    const page = request.query.page || 1; //return first page by default
    const searchCategory = request.query.category;
    const searchQuery = request.query.query;
    let sortBy = request.query.price;
  
    //translate sort query into mongo terminology
    if (sortBy === 'highest') {
      sortBy = 'desc';
    } else if (sortBy === 'lowest') {
      sortBy = 'asc';
    }
  
    //get all available categories
    Product
      .distinct('category')
      .exec((error, categories) => {
        //send error
        if (error) return response.send(error.message);
  
        //set categories
        const availableCategories = categories;
  
        //search to get filtered result count
        Product
          .find(searchCategory ? { category: searchCategory } : {}) //optionally filter by category
          .collation({ locale: 'en', strength: 2 }) //make search case insensitive
          .where(searchQuery ? { name: { $regex: searchQuery, $options: 'i' } } : {}) //optionally search by query (case insensitive)
          .countDocuments() //count how many filtered results were found
          .exec((error, count) => {
            //send error
            if (error) return response.send("Error: " + error.message);
  
            //save count
            const resultCount = count;
  
            //search to get filtered result products
            Product
              .find(searchCategory ? { category: searchCategory } : {}) //optionally filter by category
              .collation({ locale: 'en', strength: 2 }) //make search case insensitive
              .where(searchQuery ? { name: { $regex: searchQuery, $options: 'i' } } : {}) //optionally search by query (case insensitive)
              .sort(sortBy ? { price: sortBy } : 0) //optionally sort by price
              .skip((perPage * page) - perPage) //skip results based on page number
              .limit(perPage) //limit results per page
              .exec((error, products) => {
                //send error if page doesn't exist
                if (page > 1 && products.length === 0) return response.status(404).send("Page does not exist");
  
                //if another error, send error
                if (error) return response.send("Error: " + error.message);
  
                //send count of total filtered results and limited products
                response.send({ count: resultCount, categories: availableCategories, product_results: products });
              });
          });
      });
  });
  
  app.get('/api/products/:product', (request, response, next) => {
  
    //find product with product id
    Product
      .findById(request.params.product)
      .exec((error, foundProduct) => {
        //if no product found with that id, return error
        if (!foundProduct) return response.status(404).send("Product not found");
  
        //if another error, send error
        if (error) return response.send("Error: " + error.message);
  
        //send product if found
        response.send(foundProduct);
      });
  });
  
  app.get('/api/products/:product/reviews', (request, response, next) => {
    //get product id
    const productId = request.params.product;
  
    //get page number, default to page 1
    const reviewsPage = request.query.page || 1;
  
    //set number of reviews per page 
    const reviewsPerPage = 4;
  
    //set up skip formula
    const reviewsToSkip = (reviewsPerPage * reviewsPage) - reviewsPerPage;
  
    //get count of reviews for pagination
    Product
      .findById(productId)
      .exec((error, foundProduct) => {
        //if no product by that id found, send error
        if (!foundProduct) return response.status(404).send("Product not found")
  
        //if another error, send error
        if (error) return response.send(error);
  
        //save count
        const reviewCount = foundProduct.reviews.length;
  
        //find product and get reviews
        Product //perform a skip and limit on review items
          .findOne({ _id: productId }, { reviews: { $slice: [reviewsToSkip, reviewsPerPage] } })
          .exec((error, foundProduct) => {
            //if no product by that id found, send error
            if (!foundProduct) return response.status(404).send("Product not found")
  
            //send error if page doesn't exist
            if (reviewsPage > 1 && foundProduct.reviews.length === 0) return response.status(404).send("Page does not exist")
  
            //if another error, send error
            if (error) return response.send(error.message);
  
            //send reviews and count
            response.send({ total_review_count: reviewCount, reviews: foundProduct.reviews });
          });
      });
  });
  
  app.post('/api/products', (request, response, next) => {
    //get product info from request
    const productToAdd = request.body;
  
    //check if product info was sent
    if (!productToAdd || !productToAdd.name || !productToAdd.category || !productToAdd.image || !productToAdd.price) {
      return response.status(400).send("Invalid parameters. Requires name, price, category, and image");
    }
  
    //create a new product
    Product
      .create(productToAdd, (error, addedProduct) => {
        //send error if product not added
        if (error) return response.send(error.message);
  
        //send new product
        response.send(addedProduct);
      });
  });
  
  app.post('/api/products/:product/reviews', (request, response, next) => {
  
    //get review from request
    const reviewToAdd = request.body;
  
    //check for valid fields on review
    if (!reviewToAdd.username || !reviewToAdd.text) return response.status(400).send("Invalid parameters. Requires username and text.")
  
    Product  //find the product to review  && add review to product's reviews array
      .updateOne({ _id: request.params.product }, { $push: { reviews: reviewToAdd } })
      .exec((error, updatedProduct) => {
        //send error if invalid product id
        if (!updatedProduct) return response.status(404).send("Product not found");
  
        //send error if product not found/review not updated
        if (error) return response.send(error.message);
  
        //send confirmation
        response.send("Review added");
      });
  });
  
  app.delete('/api/products/:product', (request, response, next) => {
    Product
      .where({ _id: request.params.product })
      .findOneAndDelete((error, deletedProduct) => {
        //send error if product not found
        if (!deletedProduct) return response.status(404).send("Product not found")
  
        //if another error, send error
        if (error) return response.send(error.message);
  
        //send confirmation
        response.send("Product has been removed");
      });
  });
  
  app.delete('/api/reviews/:review', (request, response, next) => {
    Product
      .updateOne({ reviews: { $elemMatch: { _id: request.params.review } } }, { $pull: { reviews: { _id: request.params.review } } })
      .exec((error, deletedReview) => {
        //send error if review not found
        if (!deletedReview) return response.status(404).send("Review not found");
  
        //if another error, send error
        if (error) return response.send(error.message)
  
        //send confirmation
        response.send("Review has been removed");
      })
  });
}


// module.exports = router;