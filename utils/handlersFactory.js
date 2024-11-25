const asyncHandler = require('express-async-handler');
const ApiError = require('./apiError');
const ApiResponse = require('./apiResponse');
const ApiFeatures = require('./apiFeatures');
const { catchError } = require('../middlewares/catchErrorMiddleware');
const { withTransaction } = require('../helpers/transactionHelper');
const redisClient = require('../config/redis');
const lazyRevalidation = require('../helpers/cacheHelper');

const invalidateCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
};

exports.createOne = (Model) =>
  catchError(
    asyncHandler(async (req, res) => {
      let newDoc;
      await withTransaction(async (session) => {
        newDoc = await Model.create([{ ...req.body }], { session });
      });

      // Invalidate or update the cache
      await invalidateCache(`${Model.modelName}_list_*`);

      const response = new ApiResponse(
        201,
        newDoc[0],
        `${Model.modelName} created successfully`,
      );
      res.status(response.statusCode).json(response);
    }),
  );

exports.updateOne = (Model) =>
  catchError(
    asyncHandler(async (req, res, next) => {
      const { id } = req.params;

      let document;
      await withTransaction(async (session) => {
        document = await Model.findByIdAndUpdate(id, req.body, {
          new: true,
          session,
        });

        if (!document) {
          return next(
            new ApiError(`No document found for this ID: ${id}`, 404),
          );
        }

        // Update cache
        const cacheKey = `${Model.modelName}_${id}`;
        await redisClient.set(cacheKey, JSON.stringify(document), { EX: 120 });
        await invalidateCache(`${Model.modelName}_list_*`);

        const response = new ApiResponse(
          200,
          document,
          `${Model.modelName} updated successfully`,
        );
        res.status(response.statusCode).json(response);
      });
    }),
  );

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

        // Invalidate the cache
        await invalidateCache(`${Model.modelName}_${id}`);
        await invalidateCache(`${Model.modelName}_list_*`);

        const response = new ApiResponse(
          204,
          null,
          `${Model.modelName} deleted successfully`,
        );
        res.status(response.statusCode).json(response);
      });
    }),
  );

exports.getOne = (Model, populationOpt) =>
  catchError(
    asyncHandler(async (req, res, next) => {
      const { id } = req.params;
      const cacheKey = `${Model.modelName}_${id}`;

      const queryFn = async () => {
        let query = Model.findById(id).lean();
        if (populationOpt) query = query.populate(populationOpt);
        return await query;
      };

      const document = await lazyRevalidation(cacheKey, queryFn, 120);

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
      const page = req.query.page || 1;
      const cacheKey = `${Model.modelName}_list_page_${page}`;

      let filter = req.filterObj || {};

      const queryFn = async () => {
        const documentsCounts = await Model.countDocuments(filter);
        const apiFeatures = new ApiFeatures(Model.find(filter).lean(), req.query)
          .paginate(documentsCounts)
          .filter()
          .search(searchableFields)
          .limitFields()
          .sort();

        const { mongooseQuery, paginationResult } = apiFeatures;
        const documents = await mongooseQuery;
        return { documents, paginationResult };
      };

      const { documents, paginationResult } = await lazyRevalidation(
        cacheKey,
        queryFn,
        120,
      );

      if (!documents) {
        return next(new ApiError(`No ${Model.modelName} found`, 404));
      }

      const response = new ApiResponse(
        200,
        { results: documents.length, paginationResult, data: documents },
        `${Model.modelName} retrieved successfully`,
      );

      res.status(response.statusCode).json(response);
    }),
  );
