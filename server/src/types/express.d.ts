declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: "admin" | "custom";
    }
  }
}

export {};
