import api from './api.ts';
import type {ChatMessage, Conversation} from '../types.ts';

export async function getConversations(): Promise<Conversation[]> {
    const {data} = await api.get<Conversation[]>('/conversations/');
    return data;
}

export async function createConversation(payload: {patient: number} | {doctor: number}): Promise<Conversation> {
    const {data} = await api.post<Conversation>('/conversations/', payload);
    return data;
}

export async function getConversationMessages(conversationId: number | string): Promise<ChatMessage[]> {
    const {data} = await api.get<ChatMessage[]>(`/conversations/${conversationId}/messages/`);
    return data;
}

export async function getAppointmentMessages(appointmentId: number | string): Promise<ChatMessage[]> {
    const {data} = await api.get<ChatMessage[]>(`/appointments/${appointmentId}/messages/`);
    return data;
}

export async function uploadConversationFile(conversationId: number | string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    await api.post(`/conversations/${conversationId}/messages/`, formData);
}

export async function uploadAppointmentFile(appointmentId: number | string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    await api.post(`/appointments/${appointmentId}/messages/`, formData);
}

