import { resolveTenantApiHostname } from './core/tenant-host';

export class Apiendpointd {
  /**
   * Tenant admin API base.
   * Uses the current browser hostname (e.g. abd.localhost) so each tenant
   * hits its own Laravel host on :8000.
   */
  public static get mianUrl(): string {
    const apiHost = resolveTenantApiHostname();
    if (!apiHost) {
      throw new Error('Tenant host is required (use e.g. abd.localhost, not plain localhost).');
    }
    return `http://${apiHost}:8000/api/admins/`;
  }
  /** Non-admin tenant API root (`/api/`) for compounds, gates, parkings, elevators, suites. */
  public static get apiRoot(): string {
    return this.mianUrl.replace(/\/api\/admins\/?$/, '/api/');
  }

  public static get broadcastingAuth(): string {
    return this.apiRoot + 'broadcasting/auth';
  }

  public static get extendedBuildings(): string {
    return this.mianUrl + 'extended-buildings/';
  }

  public static get buildingData(): string {
    return this.extendedBuildings + 'building-data';
  }

  public static get propertyPage(): string {
    return this.extendedBuildings + 'property-page';
  }

  public static get adminDashboard(): string {
    return this.mianUrl + 'dashboard';
  }

  public static get dataById(): string {
    return this.extendedBuildings + 'data-by-id';
  }

  public static get addBuildin(): string {
    return this.extendedBuildings + 'add-building';
  }

  public static get updateBuilding(): string {
    return this.extendedBuildings + 'update-building';
  }

  public static get deleteBuilding(): string {
    return this.extendedBuildings + 'delete-building';
  }

  public static activateBuilding(id: number | string): string {
    return `${this.extendedBuildings}activate/${id}`;
  }

  public static inactivateBuilding(id: number | string): string {
    return `${this.extendedBuildings}inactivate/${id}`;
  }

  public static get addFloor(): string {
    return this.extendedBuildings + 'add-floor';
  }

  public static get updateFloor(): string {
    return this.extendedBuildings + 'update-floor';
  }

  public static get deleteFloor(): string {
    return this.extendedBuildings + 'delete-floor';
  }

  public static activateFloor(id: number | string): string {
    return `${this.extendedBuildings}floor/activate/${id}`;
  }

  public static inactivateFloor(id: number | string): string {
    return `${this.extendedBuildings}floor/inactivate/${id}`;
  }

  public static get rooms(): string {
    return this.extendedBuildings + 'rooms/';
  }

  public static get roomsBatch(): string {
    return this.rooms + 'batch';
  }

  public static get roomsStatus(): string {
    return this.extendedBuildings + 'rooms/status';
  }

  public static get roomsAvailability(): string {
    return this.extendedBuildings + 'rooms/availability';
  }

  public static roomClasses(id: number | string): string {
    return `${this.extendedBuildings}rooms/${id}/classes`;
  }

  public static get weekends(): string {
    return this.mianUrl + 'weekends';
  }

  public static weekendById(id: number | string): string {
    return `${this.weekends}/${id}`;
  }

  public static get gregorianHolidays(): string {
    return this.mianUrl + 'gregorian-holidays';
  }

  public static gregorianHolidayById(id: number | string): string {
    return `${this.gregorianHolidays}/${id}`;
  }

  public static get islamicHolidays(): string {
    return this.mianUrl + 'islamic-holidays';
  }

  public static islamicHolidayById(id: number | string): string {
    return `${this.islamicHolidays}/${id}`;
  }

  public static get durations(): string {
    return this.mianUrl + 'durations';
  }

  public static durationById(id: number | string): string {
    return `${this.durations}/${id}`;
  }

  public static durationActivate(id: number | string): string {
    return `${this.durations}/${id}/activate`;
  }

  public static durationInactivate(id: number | string): string {
    return `${this.durations}/${id}/inactivate`;
  }

  public static roomById(id: number | string): string {
    return `${this.rooms}${id}`;
  }

  public static roomUpdate(id: number | string): string {
    return `${this.rooms}update/${id}`;
  }

  public static activateRoom(id: number | string): string {
    return `${this.rooms}inactivate/${id}`.replace('inactivate', 'activate');
  }

  public static inactivateRoom(id: number | string): string {
    return `${this.rooms}inactivate/${id}`;
  }

  public static get roomTypes(): string {
    return this.extendedBuildings + 'room_types/';
  }

  public static roomTypeById(id: number | string): string {
    return `${this.roomTypes}${id}`;
  }

  public static activateRoomType(id: number | string): string {
    return `${this.roomTypes}activate/${id}`;
  }

  public static inactivateRoomType(id: number | string): string {
    return `${this.roomTypes}inactivate/${id}`;
  }

  public static get facilities(): string {
    return this.extendedBuildings + 'facilities';
  }

  public static facilityById(id: number | string): string {
    return `${this.facilities}/${id}`;
  }

  public static get facilityTypes(): string {
    return this.extendedBuildings + 'facility_types';
  }

  public static facilityTypeById(id: number | string): string {
    return `${this.facilityTypes}/${id}`;
  }

  public static get freeRooms(): string {
    return this.extendedBuildings + 'free-rooms';
  }

  public static get buildings(): string {
    return this.extendedBuildings + 'all';
  }

  public static get compounds(): string {
    return this.apiRoot + 'compounds/';
  }

  public static compoundById(id: number | string): string {
    return `${this.compounds}${id}`;
  }

  public static activateCompound(id: number | string): string {
    return `${this.compounds}activate/${id}`;
  }

  public static inactivateCompound(id: number | string): string {
    return `${this.compounds}inactivate/${id}`;
  }

  public static get suites(): string {
    return this.apiRoot + 'suites/';
  }

  public static suiteById(id: number | string): string {
    return `${this.suites}${id}`;
  }

  public static get activateSuite(): string {
    return this.suites + 'activate';
  }

  public static get inactivateSuite(): string {
    return this.suites + 'inactivate';
  }

  public static get gates(): string {
    return this.apiRoot + 'gates/';
  }

  public static gateById(id: number | string): string {
    return `${this.gates}${id}`;
  }

  public static get parkings(): string {
    return this.apiRoot + 'parkings/';
  }

  public static parkingById(id: number | string): string {
    return `${this.parkings}${id}`;
  }

  public static get elevators(): string {
    return this.apiRoot + 'elevators/';
  }

  public static elevatorById(id: number | string): string {
    return `${this.elevators}${id}`;
  }

  public static get locks(): string {
    return this.mianUrl + 'locks';
  }

  public static lockById(id: number | string): string {
    return `${this.locks}/${id}`;
  }

  public static propertyLocks(type: string, id: number | string): string {
    return `${this.mianUrl}properties/${type}/${id}/locks`;
  }

  public static propertyLockById(type: string, id: number | string, lockId: number | string): string {
    return `${this.propertyLocks(type, id)}/${lockId}`;
  }

  //---------------------Auth-----------------------------
  public static get login(): string {
    return this.mianUrl + 'login';
  }

  public static get verify(): string {
    return this.mianUrl + 'verify';
  }

  public static get me(): string {
    return this.mianUrl + 'me';
  }

  //---------------------Users / Admins--------------------
  public static get users(): string {
    return this.mianUrl + 'users-management/';
  }

  public static userById(id: number | string): string {
    return `${this.users}${id}`;
  }

  public static get usersSearchName(): string {
    return this.users + 'search-name';
  }

  public static get usersSearch(): string {
    return this.users + 'search';
  }

  public static get admins(): string {
    return this.mianUrl;
  }

  public static get adminsList(): string {
    return this.mianUrl;
  }

  public static get adminsUpdate(): string {
    return this.mianUrl + 'update';
  }

  public static get adminsActive(): string {
    return this.mianUrl + 'active';
  }

  public static get adminsInactive(): string {
    return this.mianUrl + 'inactive';
  }

  public static get adminsResetPassword(): string {
    return this.mianUrl + 'reset-password';
  }

  public static get adminsChangePassword(): string {
    return this.mianUrl + 'change-password';
  }

  public static get rolesPermissions(): string {
    return this.mianUrl + 'roles-permissions/';
  }

  public static get rolesPage(): string {
    return this.rolesPermissions + 'page';
  }

  public static get roles(): string {
    return this.rolesPermissions + 'roles';
  }

  public static roleById(id: number | string): string {
    return `${this.roles}/${id}`;
  }

  public static get permissions(): string {
    return this.rolesPermissions + 'permissions';
  }

  public static get rolesSync(): string {
    return this.rolesPermissions + 'sync';
  }

  public static userBookings(userId: number | string): string {
    return `${this.mianUrl}bookings/user/${userId}`;
  }

  public static get bookings(): string {
    return this.mianUrl + 'bookings';
  }

  public static get bookingsDeleted(): string {
    return this.bookings + '/deleted';
  }

  public static get bookingsByUnit(): string {
    return this.bookings + '/unit/filter';
  }

  public static bookingById(id: number | string): string {
    return `${this.bookings}/${id}`;
  }

  public static get bookingsValidate(): string {
    return this.bookings + '/validate-availability';
  }

  public static bookingCancel(id: number | string): string {
    return `${this.bookings}/${id}/cancel`;
  }

  public static bookingHold(id: number | string): string {
    return `${this.bookings}/${id}/hold`;
  }

  public static bookingResume(id: number | string): string {
    return `${this.bookings}/${id}/resume`;
  }

  public static bookingAssignLocks(id: number | string): string {
    return `${this.bookings}/${id}/assign-locks`;
  }

  public static bookingRemoveLocks(id: number | string): string {
    return `${this.bookings}/${id}/remove-locks`;
  }

  public static bookingAssignUnits(id: number | string): string {
    return `${this.bookings}/${id}/assign-units`;
  }

  public static bookingRemoveUnits(id: number | string): string {
    return `${this.bookings}/${id}/remove-units`;
  }

  public static bookingOccupants(id: number | string): string {
    return `${this.bookings}/${id}/occupants`;
  }

  public static bookingOccupantWithdraw(id: number | string, userId: number | string): string {
    return `${this.bookings}/${id}/occupants/${userId}/withdraw`;
  }

  public static get doorUnlockHistory(): string {
    return this.mianUrl + 'door-unlock-history';
  }

  public static doorUnlockHistoryByRoom(roomId: number | string): string {
    return `${this.doorUnlockHistory}/room/${roomId}`;
  }

  //---------------------Education-------------------------
  public static get education(): string {
    return this.mianUrl + 'education/';
  }

  public static get days(): string {
    return this.education + 'days';
  }

  public static get subjects(): string {
    return this.education + 'subjects';
  }

  public static subjectById(id: number | string): string {
    return `${this.subjects}/${id}`;
  }

  public static get sections(): string {
    return this.education + 'sections';
  }

  public static get educationRooms(): string {
    return this.education + 'rooms';
  }

  public static get educationSchedule(): string {
    return this.education + 'schedule';
  }

  public static sectionById(id: number | string): string {
    return `${this.sections}/${id}`;
  }

  public static sectionTimes(sectionId: number | string): string {
    return `${this.sections}/${sectionId}/times`;
  }

  public static sectionTimeById(sectionId: number | string, id: number | string): string {
    return `${this.sections}/${sectionId}/times/${id}`;
  }

  public static get enrollments(): string {
    return this.education + 'enrollments';
  }

  public static get enrollmentsPage(): string {
    return this.education + 'enrollments-page';
  }

  public static enrollmentById(id: number | string): string {
    return `${this.enrollments}/${id}`;
  }

  public static enrollmentStatus(id: number | string): string {
    return `${this.enrollments}/${id}/status`;
  }

  public static get academicTerms(): string {
    return this.education + 'academic-terms';
  }

  public static academicTermById(id: number | string): string {
    return `${this.academicTerms}/${id}`;
  }

  public static academicTermClose(id: number | string): string {
    return `${this.academicTermById(id)}/close`;
  }

  public static academicTermAssignSections(id: number | string): string {
    return `${this.academicTermById(id)}/assign-sections`;
  }

  public static get enrollmentArchives(): string {
    return this.education + 'enrollment-archives';
  }

  public static get enrollmentHistory(): string {
    return this.education + 'enrollment-history';
  }

  public static get enrollmentArchivesArchiveAll(): string {
    return this.enrollmentArchives + '/archive-all';
  }

  public static studentSchedule(userId: number | string): string {
    return `${this.education}students/${userId}/schedule`;
  }

  public static get educationFacilities(): string {
    return this.education + 'facilities';
  }

  public static studentFacilityAccess(userId: number | string): string {
    return `${this.education}students/${userId}/facility-access`;
  }

  public static studentEnrollmentHistory(userId: number | string): string {
    return `${this.education}students/${userId}/enrollment-history`;
  }

  public static get educationReports(): string {
    return this.education + 'reports';
  }

  public static get educationEvents(): string {
    return this.education + 'events';
  }

  public static educationEventById(id: number | string): string {
    return `${this.educationEvents}/${id}`;
  }

  public static get educationEventRooms(): string {
    return `${this.educationEvents}/rooms`;
  }

  public static get educationEventValidate(): string {
    return `${this.educationEvents}/validate-availability`;
  }

  public static educationEventActivate(id: number | string): string {
    return `${this.educationEventById(id)}/activate`;
  }

  public static educationEventCancel(id: number | string): string {
    return `${this.educationEventById(id)}/cancel`;
  }

  public static get compoundAccess(): string {
    return this.mianUrl + 'compound-access';
  }

  public static get compoundAccessCompounds(): string {
    return this.compoundAccess + '/compounds';
  }

  public static compoundAccessStudents(query?: string): string {
    const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return `${this.compoundAccess}/students${qs}`;
  }

  public static compoundAccessStudent(userId: number | string): string {
    return `${this.compoundAccess}/students/${userId}`;
  }
}
