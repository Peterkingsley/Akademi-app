import { AxiosError } from "axios";

export const getErrorMessage = (err: any): string => {
  if (err?.response) {
    // Log detailed error info for developers
    console.error("API Error Response:", {
      status: err.response.status,
      statusText: err.response.statusText,
      data: err.response.data,
    });

    const data = err.response.data;

    // Check for specific error message fields in the response body
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (data?.errors) {
      if (Array.isArray(data.errors)) {
        return data.errors.map((e: any) => e.message || e).join(", ");
      }
      if (typeof data.errors === 'object') {
        return Object.values(data.errors).join(", ");
      }
    }

    return `Request failed with status ${err.response.status}`;
  }

  if (err?.request) {
    console.error("API Error Request:", err.request);
    return "No response from server. Please check your connection.";
  }

  return err?.message || "An unexpected error occurred.";
};
