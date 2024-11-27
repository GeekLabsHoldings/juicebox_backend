class ApiFeatures {
  constructor(mongooseQuery, queryString, modelName) {
    this.mongooseQuery = mongooseQuery;
    this.queryString = queryString;
    this.modelName = modelName;
  }

  filter() {
    const queryStringObj = { ...this.queryString };
    const excludesFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludesFields.forEach((field) => delete queryStringObj[field]);
    // Apply filtration using [gte, gt, lte, lt]
    let queryStr = JSON.stringify(queryStringObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.mongooseQuery = this.mongooseQuery.find(JSON.parse(queryStr));

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.mongooseQuery = this.mongooseQuery.sort(sortBy);
    } else {
      this.mongooseQuery = this.mongooseQuery.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.mongooseQuery = this.mongooseQuery.select(fields);
    } else {
      this.mongooseQuery = this.mongooseQuery.select('-__v');
    }
    return this;
  }

  search(searchableFields = []) {
    if (this.queryString.search) {
      const searchQuery = this.queryString.search.trim();
      const trie = require('./searchTrie').trieMap.get(this.modelName);

      if (trie) {
        // Search in Trie
        const trieResults = trie.search(searchQuery);
        const ids = trieResults.map((result) => result._id); // Extract IDs
        this.mongooseQuery = this.mongooseQuery.find({ _id: { $in: ids } });
      } else {
        // Fallback to MongoDB search
        const searchConditions = searchableFields.map((field) => ({
          [field]: { $regex: searchQuery, $options: 'i' },
        }));
        this.mongooseQuery = this.mongooseQuery.find({ $or: searchConditions });
      }
    }

    return this;
  }

  paginate(countDocuments) {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 50;
    const skip = (page - 1) * limit;
    const endIndex = page * limit;

    // Pagination result
    const pagination = {};
    pagination.currentPage = page;
    pagination.limit = limit;
    pagination.numberOfPages = Math.ceil(countDocuments / limit);

    // next page
    if (endIndex < countDocuments) {
      pagination.next = page + 1;
    }
    if (skip > 0) {
      pagination.prev = page - 1;
    }
    this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);

    this.paginationResult = pagination;
    return this;
  }
}

module.exports = ApiFeatures;

// class ApiFeatures {
//   constructor(mongooseQuery, queryString) {
//     this.mongooseQuery = mongooseQuery;
//     this.queryString = queryString;
//   }

//   filter() {
//     const queryStringObj = { ...this.queryString };
//     const excludesFields = ['page', 'sort', 'limit', 'fields', 'search'];
//     excludesFields.forEach((field) => delete queryStringObj[field]);
//     // Apply filtration using [gte, gt, lte, lt]
//     let queryStr = JSON.stringify(queryStringObj);
//     queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

//     this.mongooseQuery = this.mongooseQuery.find(JSON.parse(queryStr));

//     return this;
//   }

//   sort() {
//     if (this.queryString.sort) {
//       const sortBy = this.queryString.sort.split(',').join(' ');
//       this.mongooseQuery = this.mongooseQuery.sort(sortBy);
//     } else {
//       this.mongooseQuery = this.mongooseQuery.sort('-createdAt');
//     }
//     return this;
//   }

//   limitFields() {
//     if (this.queryString.fields) {
//       const fields = this.queryString.fields.split(',').join(' ');
//       this.mongooseQuery = this.mongooseQuery.select(fields);
//     } else {
//       this.mongooseQuery = this.mongooseQuery.select('-__v');
//     }
//     return this;
//   }

//   search(searchableFields = []) {
//     if (this.queryString.search) {
//       const searchQuery = this.queryString.search.trim();

//       // Dynamically build the search query using provided searchable fields
//       const searchConditions = searchableFields.map((field) => ({
//         [field]: { $regex: searchQuery, $options: 'i' },
//       }));

//       this.mongooseQuery = this.mongooseQuery.find({ $or: searchConditions });
//     }

//     return this;
//   }

//   paginate(countDocuments) {
//     const page = this.queryString.page * 1 || 1;
//     const limit = this.queryString.limit * 1 || 50;
//     const skip = (page - 1) * limit;
//     const endIndex = page * limit;

//     // Pagination result
//     const pagination = {};
//     pagination.currentPage = page;
//     pagination.limit = limit;
//     pagination.numberOfPages = Math.ceil(countDocuments / limit);

//     // next page
//     if (endIndex < countDocuments) {
//       pagination.next = page + 1;
//     }
//     if (skip > 0) {
//       pagination.prev = page - 1;
//     }
//     this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);

//     this.paginationResult = pagination;
//     return this;
//   }
// }

// module.exports = ApiFeatures;
