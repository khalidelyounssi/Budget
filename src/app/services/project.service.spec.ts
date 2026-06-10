import { Project } from '../models/project';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  let service: ProjectService;

  const project: Project = {
    id: 'project-1',
    name: 'Office Renovation',
    description: 'Lobby upgrades',
    estimatedBudget: 3000,
    createdAt: '2026-06-09T10:00:00.000Z',
    expenses: [],
  };

  beforeEach(() => {
    localStorage.clear();
    service = new ProjectService();
  });

  it('adds a project and saves it locally', () => {
    service.addProject({ ...project });

    expect(service.getProjects().length).toBe(1);
    expect(service.getProjectById('project-1')?.name).toBe('Office Renovation');
  });

  it('calculates total expenses and remaining budget', () => {
    service.addProject({ ...project, expenses: [] });
    service.addExpense('project-1', {
      id: 'expense-1',
      name: 'Peinture',
      amount: 1200,
      date: '2026-06-09',
      category: 'Peinture',
    });
    service.addExpense('project-1', {
      id: 'expense-2',
      name: 'Transport',
      amount: 500,
      date: '2026-06-09',
      category: 'Transport',
    });

    const savedProject = service.getProjectById('project-1');

    expect(savedProject).toBeTruthy();
    expect(service.calculateTotalExpenses(savedProject!)).toBe(1700);
    expect(service.calculateRemainingBudget(savedProject!)).toBe(1300);
  });

  it('recalculates after deleting an expense', () => {
    service.addProject({ ...project, expenses: [] });
    service.addExpense('project-1', {
      id: 'expense-1',
      name: 'Matériel',
      amount: 900,
      date: '2026-06-09',
    });

    service.deleteExpense('project-1', 'expense-1');

    expect(service.calculateTotalExpenses(service.getProjectById('project-1')!)).toBe(0);
  });

  it('updates the local profile', () => {
    service.updateProfile({ name: 'Esther Howard', initials: 'eh' });

    expect(service.getProfile()).toEqual({ name: 'Esther Howard', initials: 'EH' });
  });

  it('restores projects, user notes and profile from a JSON backup', () => {
    service.restoreBackup(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-06-09T10:00:00.000Z',
        profile: { name: 'My Budget', initials: 'MB' },
        projects: [{ ...project, expenses: [] }],
        userNotes: [
          {
            id: 'note-1',
            title: 'Note personnelle',
            content: 'Important note',
            createdAt: '2026-06-09T10:00:00.000Z',
            updatedAt: '2026-06-09T10:00:00.000Z',
          },
        ],
      }),
    );

    expect(service.getProjects().length).toBe(1);
    expect(service.getUserNotes().length).toBe(1);
    expect(service.getProfile().name).toBe('My Budget');
  });
});
