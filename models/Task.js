import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
    dueDate: { type: Date },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    tags: [{ type: String }],
    completed: { type: Boolean, default: false },
    reminderMinutesBefore: { type: Number, min: 0 },
  },
  { timestamps: true }
);

const Task = mongoose.model('Task', taskSchema);

export default Task;
