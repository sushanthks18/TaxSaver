import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { validate, schemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Register new user
router.post(
  '/register',
  validate(schemas.register),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body;

    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
    });

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
      },
      message: 'User registered successfully',
    });
  })
);

// Login
router.post(
  '/login',
  validate(schemas.login),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await authService.login({ email, password });

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
      },
      message: 'Login successful',
    });
  })
);

// Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await authService.getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  })
);

// Logout (client-side token removal, but we log it)
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // In a stateless JWT system, logout is handled client-side
    // But we can log the action for audit purposes
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

export default router;
