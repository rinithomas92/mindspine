export type Role = "patient" | "practitioner" | "admin";
export type User = {
    id: string;
    name: string;
    email: string;
    role: Role;
    specialty?: string;
    active: number;
    phone: string;
    history: string;
    created_at: string;
};
export type Appointment = {
    id: string;
    patient_id: string;
    practitioner_id: string;
    patient: string;
    practitioner: string;
    starts_at: string;
    service: string;
    status: "confirmed" | "completed" | "cancelled";
    reason: string;
    amount: number;
};
export type ClinicalNote = {
    assessment_json?: string;
    id: string;
    patient_id: string;
    practitioner_id: string;
    appointment_id: string;
    patient: string;
    practitioner: string;
    diagnosis: string;
    notes: string;
    plan: string;
    published: number;
    created_at: string;
};
export type Invoice = {
    id: string;
    patient_id: string;
    appointment_id: string;
    patient: string;
    service: string;
    amount: number;
    status: "unpaid" | "paid" | "refunded" | "void";
    payment_reference: string;
    created_at: string;
};
export type Notification = {
    id: string;
    user_id: string;
    title: string;
    message: string;
    is_read: number;
    created_at: string;
};
export type Slot = {
    id: string;
    practitioner_id: string;
    practitioner: string;
    starts_at: string;
    booked: number;
};
export type FileRecord = {
    id: string;
    patient_id: string;
    name: string;
    mime: string;
    size: number;
    created_at: string;
};
export type Audit = {
    id: string;
    actor: string;
    action: string;
    entity: string;
    created_at: string;
};
export type AppData = {
    physioRecords: import("./physio").PhysioRecord[];
    generatedAt: string;
    user: User;
    users: User[];
    practitioners: User[];
    patients: User[];
    appointments: Appointment[];
    notes: ClinicalNote[];
    invoices: Invoice[];
    notifications: Notification[];
    slots: Slot[];
    files: FileRecord[];
    audits: Audit[];
    settings: {
        clinicName: string;
        address: string;
        cancellationHours: number;
    };
    demo: boolean;
};
