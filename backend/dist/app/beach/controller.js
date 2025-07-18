"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ./app/beach/controller.ts
const express_1 = __importDefault(require("express"));
const beachService = __importStar(require("./service"));
const schema_1 = require("./schema");
const BadRequestError_1 = require("../../error/BadRequestError"); // Sesuaikan path jika perlu
const auth_1 = require("../../middleware/auth");
const router = express_1.default.Router();
// NO AUTHENTICATION NEEDED FOR THESE ROUTES
router.post("/recommend", auth_1.authenticateJWT, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const validatedData = schema_1.PreferenceInputSchema.parse(req.body);
        const { preference_text } = validatedData;
        // Ambil user_id dari request jika ada (misal dari JWT/session di middleware auth)
        // Untuk contoh ini, kita asumsikan user_id bisa langsung ada di body jika tidak ada autentikasi
        // ATAU Anda bisa melewatkan user_id dari middleware autentikasi ke req.user.id
        const userId = req.body.user_id || null; // <--- TAMBAHKAN INI UNTUK USER_ID
        const recommendations = yield beachService.getBeachRecommendations(preference_text, userId // <--- LEWATKAN USER_ID KE SERVICE
        );
        res.json({
            message: "Beach recommendations based on your preference",
            recommendations,
        });
    }
    catch (error) {
        if (error.name === "ZodError" &&
            error.issues &&
            Array.isArray(error.issues) &&
            error.issues.length > 0) {
            return next(new BadRequestError_1.BadRequestError(`Validation Error: ${error.issues[0].message}`));
        }
        next(error);
    }
}));
router.get("/search", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const queryValidationResult = schema_1.BeachSearchQuerySchema.safeParse(req.query);
        if (!queryValidationResult.success) {
            const firstError = queryValidationResult.error.issues[0];
            throw new BadRequestError_1.BadRequestError(`Invalid query parameter: ${firstError.path.join(".")} - ${firstError.message}`);
        }
        const { search: searchQuery, limit = 10, page = 1, } = queryValidationResult.data;
        // Ubah dari searchBeaches ke searchBeachesFromML
        const beaches = yield beachService.searchBeachesFromML(
        // <--- PERUBAHAN DI SINI
        searchQuery, limit);
        res.json({
            message: "Beaches retrieved successfully",
            count: beaches.length,
            // totalCount: totalCountForSearch, // Ini akan dihandle oleh ML Service jika dia mengirim total
            page: page, // Page dari request
            limit: limit, // Limit dari request
            data: beaches,
        });
    }
    catch (error) {
        next(error);
    }
}));
// --- Route baru untuk mencari pantai terdekat ---
router.get("/nearby", // Path: /beach/nearby?lat=-6.20&lng=106.81&radius=20&limit=5&page=1
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const queryValidationResult = schema_1.NearbyBeachQuerySchema.safeParse(req.query);
        if (!queryValidationResult.success) {
            const firstError = queryValidationResult.error.issues[0];
            // Menggabungkan semua pesan error jika ada lebih dari satu
            const errorMessages = queryValidationResult.error.issues
                .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
                .join(", ");
            throw new BadRequestError_1.BadRequestError(`Invalid query parameter(s): ${errorMessages}`);
        }
        const { lat, lng, radius, // Default dari schema akan digunakan
        limit, // Default dari schema
        page, // Default dari schema
         } = queryValidationResult.data;
        const result = yield beachService.findNearbyBeaches(lat, lng, radius, limit, page);
        res.json({
            message: `Nearby beaches within ${radius}km radius`,
            countOnPage: result.data.length,
            totalCount: result.totalCount,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            data: result.data,
        });
    }
    catch (error) {
        next(error);
    }
}));
// --- End Route Baru ---
router.get("/:placeId", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { placeId } = req.params;
        if (!placeId) {
            throw new BadRequestError_1.BadRequestError("Place ID is required.");
        }
        const beachDetails = yield beachService.getBeachDetails(placeId);
        if (!beachDetails) {
            res.status(404).json({ message: "Beach not found" });
            return;
        }
        res.json(beachDetails);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = router;
//# sourceMappingURL=controller.js.map