import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from './errorHandler';

export const validate = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: errorMessages,
          },
        });
      }
      next(error);
    }
  };
};

// Common validation schemas
export const schemas = {
  // Auth schemas
  register: z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        ),
      firstName: z.string().min(1, 'First name is required').optional(),
      lastName: z.string().min(1, 'Last name is required').optional(),
    }),
  }),

  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required'),
    }),
  }),

  // Portfolio schemas
  uploadCSV: z.object({
    body: z.object({
      assetType: z.enum(['stock', 'crypto'], {
        errorMap: () => ({ message: 'Asset type must be either stock or crypto' }),
      }),
    }),
  }),

  createHolding: z.object({
    body: z.object({
      assetType: z.enum(['stock', 'crypto']),
      assetSymbol: z.string().min(1, 'Asset symbol is required'),
      quantity: z.number().positive('Quantity must be positive'),
      averageBuyPrice: z.number().positive('Price must be positive'),
      purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
      platform: z.string().optional(),
    }),
  }),

  // Tax report schemas
  generateReport: z.object({
    body: z.object({
      financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid financial year format (YYYY-YY)'),
      reportType: z.enum(['capital_gains', 'tax_savings', 'itr_prefill']),
    }),
  }),
};
