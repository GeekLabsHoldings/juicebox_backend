const asyncHandler = require('express-async-handler');
const ApiError = require('./apiError');
const ApiResponse = require('./apiResponse');
const ApiFeatures = require('./apiFeatures');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const { withTransaction } = require('../helpers/transactionHelper');

exports.deleteOne = (Model) =>
  catchError(
    asyncHandler(async (req, res, next) => {
      const { id } = req.params;

      let document;

      await withTransaction(async (session) => {
        document = await Model.findByIdAndDelete(id).session(session);

        if (!document) {
          return next(
            new ApiError(`No document found for this ID: ${id}`, 404),
          );
        }

        // Trigger "remove" event if necessary
        document.deleteOne();
      });

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
      const { id } = req.params;
      const updateData = req.body;

      let document;

      await withTransaction(async (session) => {
        document = await Model.findByIdAndUpdate(id, updateData, {
          new: true,
          session,
        });

        if (!document) {
          return next(
            new ApiError(`No document found for this ID: ${id}`, 404),
          );
        }

        // Trigger "save" event after update
        document = await document.save({ session });
      });

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
      let newDoc;

      await withTransaction(async (session) => {
        newDoc = await Model.create([{ ...req.body }], { session });
      });

      const response = new ApiResponse(
        201,
        newDoc[0],
        `${Model.modelName} created successfully`,
      );
      res.status(response.statusCode).json(response);
    }),
  );

exports.getOne = (Model, populationOpt) =>
  catchError(
    asyncHandler(async (req, res, next) => {
      const { id } = req.params;

      let document;

      await withTransaction(async (session) => {
        let query = Model.findById(id).session(session);
        if (populationOpt) {
          query = query.populate(populationOpt);
        }

        document = await query;

        if (!document) {
          return next(
            new ApiError(`No document found for this ID: ${id}`, 404),
          );
        }
      });

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

      let documents;
      let documentsCounts;

      await withTransaction(async (session) => {
        documentsCounts = await Model.countDocuments().session(session);

        const apiFeatures = new ApiFeatures(
          Model.find(filter).session(session),
          req.query,
        )
          .paginate(documentsCounts)
          .filter()
          .search(searchableFields)
          .limitFields()
          .sort();

        const { mongooseQuery, paginationResult } = apiFeatures;
        documents = await mongooseQuery;
      });

      const response = new ApiResponse(
        200,
        { results: documents.length, paginationResult, data: documents },
        `${Model.modelName} retrieved successfully`,
      );
      res.status(response.statusCode).json(response);
    }),
  );
