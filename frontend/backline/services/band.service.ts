import { Alert } from "react-native";
import api from "./api";
import { Band } from "@/context/AuthContext";

export const createBand = async (formData: FormData) => {
    try {
        const response = await api.post('/bands', formData);
        return response.data;
    } catch (error: any) {
        return Alert.alert("Error", "Couldn't create band.")
    }
}