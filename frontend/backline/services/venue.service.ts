import { Alert } from "react-native";
import api from "./api";

export const createVenue = async (formData: FormData) => {
    try {
        const response = await api.post('/venues', formData);
        return response.data;
    } catch (error: any) {
        return Alert.alert("Error", "Couldn't create venue.")
    }
}