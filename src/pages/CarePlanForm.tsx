import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useRef } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreatePatientOrder } from '@/hooks/useCreatePatientOrder';
import type { PatientOrderPayload } from '@/lib/api';

const formSchema = z.object({
  // Patient Information
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  mrn: z
    .string()
    .min(1, 'MRN is required')
    .regex(/^\d{6}$/, 'MRN must be exactly 6 digits'),
  primary_diagnosis: z.string().min(1, 'Primary diagnosis is required'),
  additional_diagnoses: z.array(z.string()).optional(),
  records_text: z.string(),

  // Referring Provider
  referring_provider: z.string().min(1, 'Provider name is required'),
  provider_npi: z
    .string()
    .min(1, 'NPI is required')
    .regex(/^\d{10}$/, 'NPI must be exactly 10 digits'),

  // Medication Information
  medication_name: z.string().min(1, 'Medication name is required'),
  medication_history: z.array(z.string()).optional(),
});

type FormData = z.infer<typeof formSchema>;

export function CarePlanForm() {
  const { mutate, downloadCarePlanFile, isLoading, isGeneratingCarePlan, error, confirmationError, setConfirmationError } = useCreatePatientOrder();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      additional_diagnoses: [],
      medication_history: [],
      records_text: '',
    },
  });

  const additionalDiagnoses = watch('additional_diagnoses') || [];
  const medicationHistory = watch('medication_history') || [];
  
  // Track if we just submitted to distinguish between confirmation-needed vs success
  const hasJustSubmittedRef = useRef(false);

  // Watch for confirmationError to prevent form reset and auto-trigger care plan download
  useEffect(() => {
    // If we just submitted and confirmationError was set, don't reset the form
    if (hasJustSubmittedRef.current && confirmationError) {
      hasJustSubmittedRef.current = false;
      // Modal will be shown, form should stay as-is
      return;
    }
    
    // If we just submitted and no confirmationError, it was successful
    if (hasJustSubmittedRef.current && !confirmationError && !isLoading) {
      hasJustSubmittedRef.current = false;
      
      // Auto-trigger care plan generation after successful order
      // We need to get patient_id and order_id from the mutation response
      // Store them temporarily for care plan download
      const storedResponse = sessionStorage.getItem('lastOrderResponse');
      if (storedResponse) {
        try {
          const { patient_id, order_id } = JSON.parse(storedResponse);
          // Automatically download care plan
          downloadCarePlanFile(patient_id, order_id).catch((err) => {
            console.error('Auto-care plan download failed:', err);
            // Don't block form reset if care plan download fails
          });
          sessionStorage.removeItem('lastOrderResponse');
        } catch (err) {
          console.error('Failed to parse stored order response:', err);
        }
      }
      
      reset();
      setConfirmationError(null);
    }
  }, [confirmationError, isLoading, reset, setConfirmationError, downloadCarePlanFile]);

  const submitForm = async (
    data: FormData, 
    confirmPatientMismatch = false,
    confirmProviderMismatch = false,
    confirmDuplicateOrder = false
  ) => {
    try {
      const payload: PatientOrderPayload = {
        first_name: data.first_name,
        last_name: data.last_name,
        referring_provider: data.referring_provider,
        provider_npi: data.provider_npi,
        mrn: data.mrn,
        primary_diagnosis: data.primary_diagnosis,
        additional_diagnoses:
          data.additional_diagnoses && data.additional_diagnoses.length > 0
            ? data.additional_diagnoses
            : undefined,
        medication_name: data.medication_name,
        medication_history:
          data.medication_history && data.medication_history.length > 0
            ? data.medication_history
            : undefined,
        records_text: data.records_text || '',
        confirm_patient_name_mismatch: confirmPatientMismatch,
        confirm_provider_name_mismatch: confirmProviderMismatch,
        confirm_duplicate_order: confirmDuplicateOrder,
      };

      hasJustSubmittedRef.current = true;
      const response = await mutate(payload);
      
      // Store response for care plan auto-download in useEffect
      if (response) {
        sessionStorage.setItem('lastOrderResponse', JSON.stringify({
          patient_id: response.patient_id,
          order_id: response.order_id
        }));
      }
      
      // Don't reset here - let useEffect handle it based on confirmationError state
    } catch (err) {
      hasJustSubmittedRef.current = false;
      sessionStorage.removeItem('lastOrderResponse');
      // Error handling is done in the hook
      console.error('Form submission error:', err);
    }
  };

  const onSubmit = async (data: FormData) => {
    await submitForm(data, false, false, false);
  };

  const handleConfirmProceed = () => {
    if (confirmationError && confirmationError.issues) {
      // Get current form data and resubmit with appropriate confirmation flags
      const formData = watch();
      const issues = confirmationError.issues;
      
      // Determine which flags to set based on which issues are present
      const confirmPatient = !!issues.patient;
      const confirmProvider = !!issues.provider;
      const confirmOrder = !!issues.order;
      
      submitForm(formData, confirmPatient, confirmProvider, confirmOrder);
    }
  };

  const handleCancel = () => {
    setConfirmationError(null);
  };

  const addAdditionalDiagnosis = () => {
    setValue('additional_diagnoses', [...additionalDiagnoses, '']);
  };

  const removeAdditionalDiagnosis = (index: number) => {
    const updated = additionalDiagnoses.filter((_, i) => i !== index);
    setValue('additional_diagnoses', updated);
  };

  const updateAdditionalDiagnosis = (index: number, value: string) => {
    const updated = [...additionalDiagnoses];
    updated[index] = value;
    setValue('additional_diagnoses', updated);
  };

  const addMedicationHistory = () => {
    setValue('medication_history', [...medicationHistory, '']);
  };

  const removeMedicationHistory = (index: number) => {
    const updated = medicationHistory.filter((_, i) => i !== index);
    setValue('medication_history', updated);
  };

  const updateMedicationHistory = (index: number, value: string) => {
    const updated = [...medicationHistory];
    updated[index] = value;
    setValue('medication_history', updated);
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background gradient graphic */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-gradient-lamar-soft rounded-full blur-3xl"></div>
        <div className="absolute top-20 -left-20 w-80 h-80 bg-gradient-to-br from-pink-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-4xl mx-auto py-12 px-4 relative z-10">
        <div className="mb-8 text-center">
          <img
            src="/lamarhealth.png"
            alt="Care Plan Intake Form"
            className="w-full max-w-2xl mx-auto rounded-lg mb-4"
          />
        </div>

        {/* Main form card */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100 w-full">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Patient Information */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-lamar-charcoal mb-1">Patient Information</h2>
                <p className="text-sm text-lamar-grey">Enter the patient's personal and medical information</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-lamar-charcoal font-medium text-left block">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="first_name"
                      {...register('first_name')}
                      placeholder="Enter first name"
                      className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                    />
                    {errors.first_name && (
                      <p className="text-sm text-destructive">
                        {errors.first_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-lamar-charcoal font-medium text-left block">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="last_name"
                      {...register('last_name')}
                      placeholder="Enter last name"
                      className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                    />
                    {errors.last_name && (
                      <p className="text-sm text-destructive">
                        {errors.last_name.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mrn" className="text-lamar-charcoal font-medium text-left block">
                    MRN (6 digits) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mrn"
                    {...register('mrn')}
                    placeholder="000123"
                    maxLength={6}
                    className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                  />
                  {errors.mrn && (
                    <p className="text-sm text-destructive">{errors.mrn.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primary_diagnosis" className="text-lamar-charcoal font-medium text-left block">
                    Primary Diagnosis (ICD-10) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="primary_diagnosis"
                    {...register('primary_diagnosis')}
                    placeholder="e.g., G70.00"
                    className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                  />
                  {errors.primary_diagnosis && (
                    <p className="text-sm text-destructive">
                      {errors.primary_diagnosis.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-lamar-charcoal font-medium text-left block">Additional Diagnoses (ICD-10)</Label>
                  <div className="space-y-2">
                {additionalDiagnoses.map((diagnosis, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={diagnosis}
                      onChange={(e) =>
                        updateAdditionalDiagnosis(index, e.target.value)
                      }
                      placeholder="e.g., I10"
                      className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeAdditionalDiagnosis(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAdditionalDiagnosis}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Additional Diagnosis
                  </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="records_text" className="text-lamar-charcoal font-medium text-left block">
                    Records Text
                  </Label>
                  <Textarea
                    id="records_text"
                    {...register('records_text')}
                    placeholder="Enter medical records notes..."
                    rows={4}
                    className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                  />
                  {errors.records_text && (
                    <p className="text-sm text-destructive">
                      {errors.records_text.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Referring Provider */}
            <div className="space-y-4 pt-6 border-t border-gray-100">
              <div>
                <h2 className="text-xl font-semibold text-lamar-charcoal mb-1">Referring Provider</h2>
                <p className="text-sm text-lamar-grey">Enter the referring provider's information</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="referring_provider" className="text-lamar-charcoal font-medium text-left block">
                    Provider Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="referring_provider"
                    {...register('referring_provider')}
                    placeholder="e.g., Dr. Smith"
                    className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                  />
                  {errors.referring_provider && (
                    <p className="text-sm text-destructive">
                      {errors.referring_provider.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider_npi" className="text-lamar-charcoal font-medium text-left block">
                    NPI (10 digits) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="provider_npi"
                    {...register('provider_npi')}
                    placeholder="1234567890"
                    maxLength={10}
                    className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                  />
                  {errors.provider_npi && (
                    <p className="text-sm text-destructive">
                      {errors.provider_npi.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Medication Information */}
            <div className="space-y-4 pt-6 border-t border-gray-100">
              <div>
                <h2 className="text-xl font-semibold text-lamar-charcoal mb-1">Medication Information</h2>
                <p className="text-sm text-lamar-grey">Enter current medication and medication history</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="medication_name" className="text-lamar-charcoal font-medium text-left block">
                    Medication Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="medication_name"
                    {...register('medication_name')}
                    placeholder="e.g., IVIG"
                    className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                  />
                  {errors.medication_name && (
                    <p className="text-sm text-destructive">
                      {errors.medication_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-lamar-charcoal font-medium text-left block">Medication History</Label>
                  <div className="space-y-2">
                {medicationHistory.map((medication, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={medication}
                      onChange={(e) =>
                        updateMedicationHistory(index, e.target.value)
                      }
                      placeholder="e.g., Prednisone 10 mg"
                      className="border-gray-200 rounded-lg focus:border-lamar-pink focus:ring-lamar-pink"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeMedicationHistory(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addMedicationHistory}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Medication History Item
                  </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-lamar text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Care Plan'
                )}
              </Button>
            </div>
            </form>
          </div>
        </div>
        
        {/* Care Plan Generation Loading Modal */}
        {isGeneratingCarePlan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 border border-gray-200">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-lamar-pink" />
                <h3 className="text-xl font-semibold text-lamar-charcoal">
                  Generating Care Plan
                </h3>
                <p className="text-sm text-lamar-grey text-center">
                  Please wait while we generate your care plan. This may take a few moments.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Multiple Issues */}
        {confirmationError && confirmationError.issues && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-lamar-charcoal mb-4">
                {confirmationError.issues.order 
                  ? 'Duplicate Order Warning' 
                  : confirmationError.issues.patient && confirmationError.issues.provider
                  ? 'Name Mismatch Detected'
                  : confirmationError.issues.patient
                  ? 'Patient Name Mismatch'
                  : 'Provider Name Mismatch'}
              </h3>
              
              <div className="mb-6 space-y-4">
                {/* Order Issue */}
                {confirmationError.issues.order && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>
                      Patient has already placed an order for <strong>{confirmationError.issues.order.medication_name}</strong>. Would you like to still proceed?
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Patient/Provider Issues (shown together if both exist) */}
                {(confirmationError.issues.patient || confirmationError.issues.provider) && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>
                      {confirmationError.issues.patient && confirmationError.issues.provider
                        ? "Both patient and provider name mismatches detected. Please review before proceeding."
                        : confirmationError.issues.patient
                        ? `Patient with MRN '${confirmationError.issues.patient.mrn}' already exists. Would you like to proceed with creating a new order for this existing patient?`
                        : confirmationError.issues.provider
                        ? `Provider with NPI '${confirmationError.issues.provider.npi}' already exists. Would you like to proceed with updating the provider name?`
                        : ''}
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Patient Details */}
                {confirmationError.issues.patient && (
                  <div className="space-y-2 text-sm text-lamar-grey border-l-4 border-lamar-pink pl-4 py-2">
                    <div className="font-semibold text-lamar-charcoal mb-2">Patient Information:</div>
                    <div>
                      <span className="font-medium text-lamar-charcoal">Existing Patient:</span>{' '}
                      {confirmationError.issues.patient.existing_name}
                    </div>
                    <div>
                      <span className="font-medium text-lamar-charcoal">You Entered:</span>{' '}
                      {confirmationError.issues.patient.submitted_name}
                    </div>
                    <div>
                      <span className="font-medium text-lamar-charcoal">MRN:</span>{' '}
                      {confirmationError.issues.patient.mrn}
                    </div>
                  </div>
                )}
                
                {/* Provider Details */}
                {confirmationError.issues.provider && (
                  <div className="space-y-2 text-sm text-lamar-grey border-l-4 border-lamar-purple pl-4 py-2">
                    <div className="font-semibold text-lamar-charcoal mb-2">Provider Information:</div>
                    <div>
                      <span className="font-medium text-lamar-charcoal">Existing Provider:</span>{' '}
                      {confirmationError.issues.provider.existing_name}
                    </div>
                    <div>
                      <span className="font-medium text-lamar-charcoal">You Entered:</span>{' '}
                      {confirmationError.issues.provider.submitted_name}
                    </div>
                    <div>
                      <span className="font-medium text-lamar-charcoal">NPI:</span>{' '}
                      {confirmationError.issues.provider.npi}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="px-6"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmProceed}
                  disabled={isLoading}
                  className="px-6 bg-gradient-lamar text-white font-semibold hover:opacity-90 transition-opacity"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Proceeding...
                    </>
                  ) : (
                    'Proceed Anyway'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

