import axios from "axios";
const api = axios.create({
    baseURL: "https://recommendation-beach-backend-production.up.railway.app",
})

export default api