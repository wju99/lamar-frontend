const API_BASE_URL = 'https://lamar-backend-api.onrender.com/api';

export interface PatientOrderPayload {
  first_name: string;
  last_name: string;
  referring_provider: string;
  provider_npi: string;
  mrn: string;
  primary_diagnosis: string;
  additional_diagnoses?: string[];
  medication_name: string;
  medication_history?: string[];
  records_text: string;
}

export interface PatientOrderResponse {
  message: string;
  patient_id: number;
  order_id: number;
}

export interface ValidationError {
  type: string;
  loc: (string | number)[];
  msg: string;
}

export interface ApiError {
  message: string;
  detail?: string | ValidationError[];
}

export async function createPatientOrder(
  payload: PatientOrderPayload
): Promise<PatientOrderResponse> {
  let response: Response;
  
  try {
    response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (fetchError) {
    // Handle network errors (CORS, connection refused, etc.)
    const error: ApiError = {
      message: 'Network error: Unable to reach the server. Please check your connection and ensure the API is running.',
      detail: fetchError instanceof Error ? fetchError.message : 'Unknown network error',
    };
    throw error;
  }

  // Check content type before parsing JSON
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  
  let data: PatientOrderResponse | { message?: string; detail?: string };
  
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      const error: ApiError = {
        message: 'Invalid JSON response from server',
        detail: 'The server returned an unexpected format.',
      };
      throw error;
    }
  } else {
    // Server returned HTML or other non-JSON content (likely a 404 page)
    await response.text(); // Consume the response body
    let errorMessage = `Server error (${response.status}): ${response.statusText}`;
    
    if (response.status === 404) {
      errorMessage = 'API endpoint not found. Please verify the API URL is correct and the server is running.';
    } else if (response.status >= 500) {
      errorMessage = 'Server error. Please try again later or contact support.';
    }
    
    const error: ApiError = {
      message: errorMessage,
      detail: `Received ${contentType || 'unknown content type'} instead of JSON`,
    };
    throw error;
  }

  if (!response.ok) {
    // At this point, data is JSON but contains error information
    const errorData = data as {
      message?: string;
      detail?: string | ValidationError[];
    };

    let errorMessage = '';
    let errorDetail: string | ValidationError[] | undefined;

    // Handle Django Ninja validation errors (422)
    if (response.status === 422 && Array.isArray(errorData.detail)) {
      // Format validation errors into a readable message
      const validationErrors = errorData.detail
        .map((err: ValidationError) => {
          const field = err.loc.slice(1).join('.');
          return `${field}: ${err.msg}`;
        })
        .join('; ');
      errorMessage = `Validation error: ${validationErrors}`;
      errorDetail = errorData.detail;
    } else if (response.status === 400) {
      // Handle 400 Bad Request errors (e.g., duplicate MRN, IntegrityError)
      // Django Ninja HttpError returns the message in "detail" field
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
        errorDetail = errorData.detail;
      } else if (errorData.message) {
        errorMessage = errorData.message;
        errorDetail = errorData.message;
      } else {
        errorMessage = 'Bad request. Please check your input.';
      }
    } else if (typeof errorData.detail === 'string') {
      errorMessage = errorData.message || errorData.detail;
      errorDetail = errorData.detail;
    } else if (errorData.message) {
      errorMessage = errorData.message;
    } else {
      errorMessage = `Request failed with status ${response.status}`;
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }

    const error: ApiError = {
      message: errorMessage,
      detail: errorDetail,
    };
    throw error;
  }

  return data as PatientOrderResponse;
}

