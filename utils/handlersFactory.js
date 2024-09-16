const asyncHandler = require('express-async-handler');
const ApiError = require('./apiError');
const ApiResponse = require('./apiResponse');
const ApiFeatures = require('./apiFeatures');
const { catchError } = require('../middlewares/catchErrorMiddleware');

exports.deleteOne = (Model) =>
  catchError(
    asyncHandler(async (req, res, next) => {
      const { id } = req.params;
      const document = await Model.findByIdAndDelete(id);

      if (!document) {
        return next(new ApiError(`No document found for this ID: ${id}`, 404));
      }

      // Trigger "remove" event if necessary
      document.deleteOne();

      const response = new ApiResponse(
        204,
        null,
        `${Model.modelName} deleted successfully`,
      );
      res.status(response.statusCode).json(response);
    }),
  );

exports.updateOne = (Model) =>
  catchError(
    asyncHandler(async (req, res, next) => {
      const document = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });

      if (!document) {
        return next(
          new ApiError(`No document found for this ID: ${req.params.id}`, 404),
        );
      }

      // Trigger "save" event after update
      document.save();

      const response = new ApiResponse(
        200,
        document,
        `${Model.modelName} updated successfully`,
      );
      res.status(response.statusCode).json(response);
    }),
  );

exports.createOne = (Model) =>
  catchError(
    asyncHandler(async (req, res) => {
      const newDoc = await Model.create(req.body);
      const response = new ApiResponse(
        201,
        newDoc,
        `${Model.modelName} created successfully`,
      );
      res.status(response.statusCode).json(response);
    }),
  );

exports.getOne = (Model, populationOpt) =>
  catchError(
    asyncHandler(async (req, res, next) => {
      const { id } = req.params;
      // 1) Build query
      let query = Model.findById(id);
      if (populationOpt) {
        query = query.populate(populationOpt);
      }

      // 2) Execute query
      const document = await query;

      if (!document) {
        return next(new ApiError(`No document found for this ID: ${id}`, 404));
      }

      const response = new ApiResponse(
        200,
        document,
        `${Model.modelName} retrieved successfully`,
      );
      res.status(response.statusCode).json(response);
    }),
  );

exports.getAll = (Model, searchableFields = []) =>
  catchError(
    asyncHandler(async (req, res) => {
      let filter = {};
      if (req.filterObj) {
        filter = req.filterObj;
      }
      // Build query
      const documentsCounts = await Model.countDocuments();
      const apiFeatures = new ApiFeatures(Model.find(filter), req.query)
        .paginate(documentsCounts)
        .filter()
        .search(searchableFields)
        .limitFields()
        .sort();

      // Execute query
      const { mongooseQuery, paginationResult } = apiFeatures;
      const documents = await mongooseQuery;

      const response = new ApiResponse(
        200,
        { results: documents.length, paginationResult, data: documents },
        `${Model.modelName} retrieved successfully`,
      );
      res.status(response.statusCode).json(response);
    }),
  );
