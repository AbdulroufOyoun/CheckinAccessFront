import { ApplicationRef, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  EduEvent,
  EventAudienceMode,
  EventRoomOption,
  EventsService,
  EventStatus,
  EventUserRef,
} from '../../services/events.service';
import { EducationService, CompoundAccessStudent } from '../../services/education.service';
import { TenantUser, UsersService } from '../../services/users.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TimePicker } from '../../shared/time-picker/time-picker';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';

type WizardStep = 1 | 2 | 3 | 4;

interface WeekdayOption {
  code: number;
  labelKey: string;
}

@Component({
  selector: 'app-event-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TimePicker, PageSkeleton],
  templateUrl: './event-create-page.html',
  styleUrls: ['../education-shared.css', './event-create-page.css'],
})
export class EventCreatePage implements OnInit {
  private readonly eventsApi = inject(EventsService);
  private readonly edu = inject(EducationService);
  private readonly usersApi = inject(UsersService);
  private readonly appRef = inject(ApplicationRef);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isRTL = false;
  saving = false;
  loadingRooms = false;
  initialLoading = false;
  step: WizardStep = 1;
  today = '';
  editId: number | null = null;
  existingStatus: EventStatus | null = null;
  loadedName = '';

  form = {
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    time_scheduled: true,
    start_time: '09:00',
    end_time: '17:00',
    weekends_included: true,
    gregorian_holidays_included: true,
    islamic_holidays_included: true,
    audience_mode: 'all_students' as EventAudienceMode,
  };

  excludedWeekdays: number[] = [];
  selectedRoomIds = new Set<number>();
  roomOptions: EventRoomOption[] = [];
  attendees: EventUserRef[] = [];
  supervisors: EventUserRef[] = [];
  attendeeQuery = '';
  supervisorQuery = '';
  readonly attendeeHits = signal<CompoundAccessStudent[]>([]);
  readonly supervisorHits = signal<TenantUser[]>([]);
  readonly attendeeSearchLoading = signal(false);
  readonly supervisorSearchLoading = signal(false);
  readonly attendeeSearchTried = signal(false);
  readonly supervisorSearchTried = signal(false);
  private attendeeSearchSeq = 0;
  private supervisorSearchSeq = 0;

  readonly weekdays: WeekdayOption[] = [
    { code: 0, labelKey: 'BOOK_DAY_SUN' },
    { code: 1, labelKey: 'BOOK_DAY_MON' },
    { code: 2, labelKey: 'BOOK_DAY_TUE' },
    { code: 3, labelKey: 'BOOK_DAY_WED' },
    { code: 4, labelKey: 'BOOK_DAY_THU' },
    { code: 5, labelKey: 'BOOK_DAY_FRI' },
    { code: 6, labelKey: 'BOOK_DAY_SAT' },
  ];

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.today = this.localIsoDate();

    const paramId = Number(this.route.snapshot.paramMap.get('id'));
    const queryId = Number(this.route.snapshot.queryParamMap.get('id'));
    const id = paramId > 0 ? paramId : queryId;

    if (id > 0) {
      this.editId = id;
      this.initialLoading = true;
      void this.loadExisting(id);
      return;
    }

    this.form.start_date = this.today;
    this.form.end_date = this.today;
  }

  get isEditMode(): boolean {
    return this.editId != null && this.editId > 0;
  }

  get isReadonly(): boolean {
    return this.existingStatus === 'cancelled';
  }

  get statusLabelKey(): string {
    const map: Record<EventStatus, string> = {
      draft: 'EVT_STATUS_DRAFT',
      active: 'EVT_STATUS_ACTIVE',
      cancelled: 'EVT_STATUS_CANCELLED',
    };
    return this.existingStatus ? map[this.existingStatus] : 'EVT_STATUS_DRAFT';
  }

  get primarySaveLabelKey(): string {
    if (!this.isEditMode) return 'EVT_SAVE_ACTIVATE';
    if (this.existingStatus === 'active') return 'EVT_SAVE_CHANGES';
    return 'EVT_UPDATE_ACTIVATE';
  }

  get draftSaveLabelKey(): string {
    return this.isEditMode ? 'EVT_UPDATE_DRAFT' : 'EVT_SAVE_DRAFT';
  }

  get canGoStep2(): boolean {
    return !!this.form.name.trim() && !!this.form.start_date && !!this.form.end_date && !this.periodTimeInvalid();
  }

  get canGoStep3(): boolean {
    return this.selectedRoomIds.size > 0;
  }

  get canSave(): boolean {
    if (!this.form.name.trim()) return false;
    if (this.form.audience_mode === 'selected_students' && this.attendees.length === 0) return false;
    if (this.supervisors.length === 0) return false;
    return this.canGoStep2 && this.canGoStep3;
  }

  get saveBlockReasonKey(): string {
    if (!this.form.name.trim()) return 'EVT_REQUIRED';
    if (this.periodTimeInvalid()) return 'EVT_TIME_INVALID';
    if (!this.form.start_date || !this.form.end_date) return 'EVT_REQUIRED';
    if (!this.canGoStep3) return 'EVT_PICK_ROOMS';
    if (this.form.audience_mode === 'selected_students' && this.attendees.length === 0) return 'EVT_PICK_ATTENDEES';
    if (this.supervisors.length === 0) return 'EVT_PICK_SUPERVISORS';
    return 'EVT_REQUIRED';
  }

  onFormChanged(): void {
    this.refreshView();
  }

  onAttendeeQueryChange(value: string): void {
    this.attendeeQuery = value;
    void this.searchAttendees();
  }

  onSupervisorQueryChange(value: string): void {
    this.supervisorQuery = value;
    void this.searchSupervisors();
  }

  /** Zoneless + ngTemplateOutlet: flush UI after async updates. */
  private refreshView(): void {
    this.cdr.markForCheck();
    queueMicrotask(() => {
      this.cdr.detectChanges();
      this.appRef.tick();
    });
  }

  periodTimeInvalid(): boolean {
    if (!this.form.time_scheduled) return false;
    return !!this.form.start_time && !!this.form.end_time && this.form.end_time <= this.form.start_time;
  }

  isExcludedDay(code: number): boolean {
    return this.excludedWeekdays.includes(code);
  }

  toggleExcludedDay(code: number): void {
    if (this.isExcludedDay(code)) {
      this.excludedWeekdays = this.excludedWeekdays.filter((c) => c !== code);
    } else {
      this.excludedWeekdays = [...this.excludedWeekdays, code];
    }
    this.onFormChanged();
  }

  isRoomSelected(id: number): boolean {
    return this.selectedRoomIds.has(id);
  }

  toggleRoom(room: EventRoomOption): void {
    if (!room.available) return;
    if (this.selectedRoomIds.has(room.id)) {
      this.selectedRoomIds.delete(room.id);
    } else {
      this.selectedRoomIds.add(room.id);
    }
    this.onFormChanged();
  }

  async goToRooms(): Promise<void> {
    if (!this.canGoStep2) {
      this.snackbar.show(this.translate.instant('EVT_REQUIRED'), 'error');
      return;
    }
    this.step = 2;
    await this.loadRooms();
  }

  async loadRooms(): Promise<void> {
    this.loadingRooms = true;
    this.cdr.detectChanges();
    try {
      const res = await this.eventsApi.rooms({
        start_date: this.form.start_date,
        end_date: this.form.end_date,
        time_scheduled: this.form.time_scheduled,
        period_times: this.form.time_scheduled
          ? [{ start_time: this.form.start_time, end_time: this.form.end_time }]
          : [],
        exclude_event_id: this.editId ?? undefined,
      });
      this.roomOptions = res.data || [];
    } catch {
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      this.loadingRooms = false;
      this.cdr.detectChanges();
    }
  }

  goAudience(): void {
    if (!this.canGoStep3) {
      this.snackbar.show(this.translate.instant('EVT_PICK_ROOMS'), 'error');
      return;
    }
    this.step = 3;
  }

  goConfirm(): void {
    if (this.form.audience_mode === 'selected_students' && this.attendees.length === 0) {
      this.snackbar.show(this.translate.instant('EVT_PICK_ATTENDEES'), 'error');
      return;
    }
    if (this.supervisors.length === 0) {
      this.snackbar.show(this.translate.instant('EVT_PICK_SUPERVISORS'), 'error');
      return;
    }
    this.step = 4;
  }

  back(): void {
    if (this.step > 1) this.step = (this.step - 1) as WizardStep;
  }

  async refreshRooms(): Promise<void> {
    if (!this.canGoStep2) {
      this.snackbar.show(this.translate.instant('EVT_REQUIRED'), 'error');
      return;
    }
    await this.loadRooms();
  }

  cancel(): void {
    void this.router.navigate(['/Education/Events']);
  }

  async searchAttendees(): Promise<void> {
    const q = this.attendeeQuery.trim();
    const seq = ++this.attendeeSearchSeq;
    if (!q) {
      this.attendeeHits.set([]);
      this.attendeeSearchTried.set(false);
      this.attendeeSearchLoading.set(false);
      this.refreshView();
      return;
    }
    this.attendeeSearchLoading.set(true);
    this.attendeeSearchTried.set(false);
    this.refreshView();
    try {
      const hits = await this.fetchAttendeeCandidates(q);
      if (seq !== this.attendeeSearchSeq) return;
      this.attendeeHits.set(this.filterAttendeeHits(hits));
    } catch {
      if (seq !== this.attendeeSearchSeq) return;
      this.attendeeHits.set([]);
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      if (seq === this.attendeeSearchSeq) {
        this.attendeeSearchLoading.set(false);
        this.attendeeSearchTried.set(true);
        this.refreshView();
      }
    }
  }

  async searchSupervisors(): Promise<void> {
    const q = this.supervisorQuery.trim();
    const seq = ++this.supervisorSearchSeq;
    if (!q) {
      this.supervisorHits.set([]);
      this.supervisorSearchTried.set(false);
      this.supervisorSearchLoading.set(false);
      this.refreshView();
      return;
    }
    this.supervisorSearchLoading.set(true);
    this.supervisorSearchTried.set(false);
    this.refreshView();
    try {
      const hits = await this.fetchSupervisorCandidates(q);
      if (seq !== this.supervisorSearchSeq) return;
      this.supervisorHits.set(this.filterSupervisorHits(hits));
    } catch {
      if (seq !== this.supervisorSearchSeq) return;
      this.supervisorHits.set([]);
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      if (seq === this.supervisorSearchSeq) {
        this.supervisorSearchLoading.set(false);
        this.supervisorSearchTried.set(true);
        this.refreshView();
      }
    }
  }

  private async fetchAttendeeCandidates(q: string): Promise<CompoundAccessStudent[]> {
    try {
      const res = await this.eventsApi.searchAttendeeCandidates(q);
      if (Array.isArray(res.data)) {
        return res.data as CompoundAccessStudent[];
      }
    } catch {
      // Fallback when backend route is missing (older deploy).
    }
    const res = await this.edu.searchCompoundAccessStudents(q);
    return Array.isArray(res.data) ? res.data : [];
  }

  private async fetchSupervisorCandidates(q: string): Promise<TenantUser[]> {
    try {
      const res = await this.eventsApi.searchSupervisorCandidates(q, 20);
      if (Array.isArray(res.data)) {
        return res.data as TenantUser[];
      }
    } catch {
      // Fallback when backend route is missing (older deploy).
    }
    const page = await this.usersApi.searchByName(q, 20);
    return page.data || [];
  }

  addAttendee(user: CompoundAccessStudent): void {
    if (this.isSupervisor(user.id)) {
      this.snackbar.show(this.translate.instant('EVT_USER_ALREADY_SUPERVISOR'), 'error');
      return;
    }
    if (this.attendees.some((u) => u.id === user.id)) return;
    this.attendees = [...this.attendees, user];
    this.attendeeQuery = '';
    this.attendeeHits.set([]);
    this.supervisorHits.set(this.filterSupervisorHits(this.supervisorHits()));
    this.onFormChanged();
  }

  removeAttendee(id: number): void {
    this.attendees = this.attendees.filter((u) => u.id !== id);
    if (this.attendeeQuery.trim()) {
      void this.searchAttendees();
    }
    if (this.supervisorQuery.trim()) {
      void this.searchSupervisors();
    }
    this.onFormChanged();
  }

  addSupervisor(user: TenantUser): void {
    if (this.isAttendee(user.id)) {
      this.snackbar.show(this.translate.instant('EVT_USER_ALREADY_ATTENDEE'), 'error');
      return;
    }
    if (this.supervisors.some((u) => u.id === user.id)) return;
    this.supervisors = [...this.supervisors, user];
    this.supervisorQuery = '';
    this.supervisorHits.set([]);
    this.attendeeHits.set(this.filterAttendeeHits(this.attendeeHits()));
    this.onFormChanged();
  }

  removeSupervisor(id: number): void {
    this.supervisors = this.supervisors.filter((u) => u.id !== id);
    if (this.supervisorQuery.trim()) {
      void this.searchSupervisors();
    }
    if (this.attendeeQuery.trim()) {
      void this.searchAttendees();
    }
    this.onFormChanged();
  }

  private isAttendee(userId: number): boolean {
    return this.attendees.some((u) => u.id === userId);
  }

  private isSupervisor(userId: number): boolean {
    return this.supervisors.some((u) => u.id === userId);
  }

  private filterAttendeeHits(hits: CompoundAccessStudent[]): CompoundAccessStudent[] {
    return hits.filter((u) => !this.isAttendee(u.id) && !this.isSupervisor(u.id));
  }

  private filterSupervisorHits(hits: TenantUser[]): TenantUser[] {
    return hits.filter((u) => !this.isSupervisor(u.id) && !this.isAttendee(u.id));
  }

  async saveDraft(): Promise<void> {
    await this.persist('draft');
  }

  async saveAndActivate(): Promise<void> {
    await this.persist('active');
  }

  conflictLabel(reason?: string | null): string {
    const map: Record<string, string> = {
      section: 'EVT_CONFLICT_SECTION',
      booking: 'EVT_CONFLICT_BOOKING',
      event: 'EVT_CONFLICT_EVENT',
    };
    return this.translate.instant(map[reason || ''] || 'EVT_CONFLICT_UNKNOWN');
  }

  private async loadExisting(id: number): Promise<void> {
    this.initialLoading = true;
    this.cdr.detectChanges();
    try {
      const res = await this.eventsApi.get(id);
      const row = res.data as EduEvent;
      if (!row) return;

      if (row.status === 'cancelled') {
        this.snackbar.show(this.translate.instant('EVT_EDIT_READONLY'), 'error');
        void this.router.navigate(['/Education/Events']);
        return;
      }

      this.existingStatus = row.status;
      this.loadedName = row.name;
      this.form.name = row.name;
      this.form.description = row.description || '';
      this.form.start_date = row.start_date;
      this.form.end_date = row.end_date;
      this.form.time_scheduled = row.time_scheduled;
      this.form.weekends_included = row.weekends_included;
      this.form.gregorian_holidays_included = row.gregorian_holidays_included;
      this.form.islamic_holidays_included = row.islamic_holidays_included;
      this.form.audience_mode = row.audience_mode;
      const slot = row.period_times?.[0];
      if (slot) {
        this.form.start_time = slot.start_time.slice(0, 5);
        this.form.end_time = slot.end_time.slice(0, 5);
      }
      this.excludedWeekdays = [...(row.excluded_weekdays || [])];
      this.selectedRoomIds = new Set((row.rooms || []).map((r) => r.id));
      this.attendees = [...(row.attendees || [])];
      this.supervisors = [...(row.supervisors || [])];
      await this.loadRooms();
    } catch {
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
      void this.router.navigate(['/Education/Events']);
    } finally {
      this.initialLoading = false;
      this.cdr.detectChanges();
    }
  }

  private async persist(status: 'draft' | 'active'): Promise<void> {
    this.onFormChanged();
    if (!this.canSave) {
      this.snackbar.show(this.translate.instant(this.saveBlockReasonKey), 'error');
      return;
    }
    this.saving = true;
    this.cdr.detectChanges();
    try {
      const body = {
        name: this.form.name.trim(),
        description: this.form.description.trim() || null,
        start_date: this.form.start_date,
        end_date: this.form.end_date,
        time_scheduled: this.form.time_scheduled,
        period_times: this.form.time_scheduled
          ? [{ start_time: this.form.start_time, end_time: this.form.end_time }]
          : [],
        excluded_weekdays: this.excludedWeekdays,
        weekends_included: this.form.weekends_included,
        gregorian_holidays_included: this.form.gregorian_holidays_included,
        islamic_holidays_included: this.form.islamic_holidays_included,
        audience_mode: this.form.audience_mode,
        room_ids: [...this.selectedRoomIds],
        attendee_user_ids: this.form.audience_mode === 'selected_students' ? this.attendees.map((u) => u.id) : [],
        supervisor_user_ids: this.supervisors.map((u) => u.id),
        status: (this.existingStatus === 'active' ? 'active' : 'draft') as 'draft' | 'active',
      };

      let saved: EduEvent;
      if (this.editId) {
        const res = await this.eventsApi.update(this.editId, body);
        saved = res.data as EduEvent;
      } else {
        const res = await this.eventsApi.create(body);
        saved = res.data as EduEvent;
        this.editId = saved.id;
      }

      if (status === 'active') {
        if (this.existingStatus !== 'active') {
          await this.eventsApi.activate(saved.id);
        }
      }

      const msgKey = this.resolveSuccessKey(status);
      this.snackbar.show(this.translate.instant(msgKey), 'success');
      void this.router.navigate(['/Education/Events']);
    } catch (e: unknown) {
      const body = (e as { error?: { message?: string } })?.error;
      this.snackbar.show(
        typeof body?.message === 'string' && body.message.trim() ? body.message : this.translate.instant('REQUEST_FAILED'),
        'error',
      );
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private resolveSuccessKey(status: 'draft' | 'active'): string {
    if (!this.isEditMode) {
      return status === 'active' ? 'EVT_SAVED_ACTIVE' : 'EVT_SAVED_DRAFT';
    }
    if (status === 'active') {
      return this.existingStatus === 'active' ? 'EVT_UPDATED' : 'EVT_SAVED_ACTIVE';
    }
    return 'EVT_UPDATED_DRAFT';
  }

  private localIsoDate(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
