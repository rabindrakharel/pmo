"""
PMO MCP API - Python Client SDK

Version: 4.0.0
Description: Type-safe client for PMO MCP API with full type hints
Author: PMO Platform Team

Requirements:
    pip install requests pydantic
"""

from typing import Optional, Dict, Any, List, Literal, TypedDict
from dataclasses import dataclass
from datetime import datetime
import requests
import time
from pydantic import BaseModel, Field, EmailStr


# ============================================================================
# Type Definitions (Pydantic Models)
# ============================================================================

class User(BaseModel):
    id: str
    email: EmailStr
    name: str
    employee_id: Optional[str] = None
    roles: List[str] = []
    permissions: Dict[str, List[str]] = {}


class AuthResponse(BaseModel):
    token: str
    expiresIn: int = Field(..., alias='expiresIn')
    user: User


class Customer(BaseModel):
    id: str
    name: str
    primary_phone: Optional[str] = None
    primary_email: Optional[EmailStr] = None
    primary_address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    created_ts: datetime
    updated_ts: datetime
    active_flag: bool = True

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CustomerCreate(BaseModel):
    name: str
    primary_phone: Optional[str] = None
    primary_email: Optional[EmailStr] = None
    primary_address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    primary_phone: Optional[str] = None
    primary_email: Optional[EmailStr] = None
    primary_address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None


TaskStage = Literal['backlog', 'in_progress', 'blocked', 'done', 'cancelled']
TaskPriority = Literal['low', 'medium', 'high', 'urgent']


class Task(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    descr: Optional[str] = None
    dl__task_stage: Optional[TaskStage] = None
    dl__task_priority: Optional[TaskPriority] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None
    created_ts: datetime
    updated_ts: datetime


class TaskCreate(BaseModel):
    name: str
    code: Optional[str] = None
    descr: Optional[str] = None
    dl__task_stage: Optional[TaskStage] = None
    dl__task_priority: Optional[TaskPriority] = None
    estimated_hours: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


AttendeeType = Literal['customer', 'employee']


class Attendee(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    type: AttendeeType


class CalendarMetadata(BaseModel):
    attendees: Optional[List[Attendee]] = None
    task_id: Optional[str] = None
    service_type: Optional[str] = None

    class Config:
        extra = 'allow'  # Allow additional fields


class CalendarBooking(BaseModel):
    id: str
    title: str
    instructions: Optional[str] = None
    slot_ids: List[str]
    metadata: Optional[CalendarMetadata] = None
    created_ts: datetime


class CalendarBookingCreate(BaseModel):
    slot_ids: List[str]
    title: str
    instructions: Optional[str] = None
    metadata: Optional[CalendarMetadata] = None


class EntityLinkage(BaseModel):
    id: str
    parent_entity_type: str
    parent_entity_id: str
    child_entity_type: str
    child_entity_id: str
    relationship_type: Optional[str] = None


class EntityLinkageCreate(BaseModel):
    parent_entity_type: str
    parent_entity_id: str
    child_entity_type: str
    child_entity_id: str
    relationship_type: Optional[str] = None


class Pagination(BaseModel):
    total: int
    page: int
    limit: int
    totalPages: int
    hasMore: bool


class PaginatedResponse(BaseModel):
    results: List[Any]
    pagination: Pagination


class ApiErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class ApiError(BaseModel):
    error: ApiErrorDetail
    statusCode: int
    timestamp: datetime


# ============================================================================
# Custom Exceptions
# ============================================================================

class PMOAPIError(Exception):
    """Custom exception for PMO API errors"""

    def __init__(self, error: ApiError):
        self.code = error.error.code
        self.message = error.error.message
        self.status_code = error.statusCode
        self.details = error.error.details
        super().__init__(f"[{self.code}] {self.message} (HTTP {self.status_code})")


class AuthenticationError(PMOAPIError):
    """Raised when authentication fails"""
    pass


class PermissionError(PMOAPIError):
    """Raised when user lacks required permissions"""
    pass


class NotFoundError(PMOAPIError):
    """Raised when resource is not found"""
    pass


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class PMOMCPClientConfig:
    base_url: str
    api_version: str = 'v1'
    timeout: int = 30
    retry_attempts: int = 3


# ============================================================================
# Main Client Class
# ============================================================================

class PMOMCPClient:
    """
    Type-safe Python client for PMO MCP API

    Example:
        >>> client = PMOMCPClient(base_url='http://localhost:4000')
        >>> auth = client.authenticate(email='user@example.com', password='pass123')
        >>> customer = client.create_customer(name='John Doe', primary_phone='+1 555 1234')
    """

    def __init__(
        self,
        base_url: str,
        api_version: str = 'v1',
        timeout: int = 30,
        retry_attempts: int = 3
    ):
        self.config = PMOMCPClientConfig(
            base_url=base_url,
            api_version=api_version,
            timeout=timeout,
            retry_attempts=retry_attempts
        )
        self.auth_token: Optional[str] = None
        self.token_expiry: Optional[float] = None
        self.session = requests.Session()

    # ========================================================================
    # Authentication
    # ========================================================================

    def authenticate(self, email: str, password: str) -> AuthResponse:
        """
        Authenticate user and obtain JWT token

        Args:
            email: User email address
            password: User password

        Returns:
            AuthResponse with token and user information

        Raises:
            AuthenticationError: If authentication fails
        """
        response = self._request(
            'POST',
            '/auth/login',
            json={'email': email, 'password': password},
            skip_auth=True
        )

        auth = AuthResponse(**response)
        self.auth_token = auth.token
        self.token_expiry = time.time() + auth.expiresIn

        return auth

    def get_profile(self) -> User:
        """Get authenticated user profile"""
        response = self._request('GET', '/auth/profile')
        return User(**response)

    def is_authenticated(self) -> bool:
        """Check if user is authenticated and token is valid"""
        return (
            self.auth_token is not None and
            self.token_expiry is not None and
            self.token_expiry > time.time()
        )

    # ========================================================================
    # Customer Operations
    # ========================================================================

    def list_customers(
        self,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        **kwargs
    ) -> PaginatedResponse:
        """
        List customers with optional filtering

        Args:
            page: Page number (default: 1)
            limit: Items per page (default: 20)
            search: Search query
            **kwargs: Additional filter parameters

        Returns:
            PaginatedResponse with customer results
        """
        params = {'page': page, 'limit': limit, **kwargs}
        if search:
            params['search'] = search

        response = self._request('GET', '/cust', params=params)
        return PaginatedResponse(**response)

    def get_customer(self, customer_id: str) -> Customer:
        """Get customer by ID"""
        response = self._request('GET', f'/cust/{customer_id}')
        return Customer(**response)

    def create_customer(self, **kwargs) -> Customer:
        """
        Create a new customer

        Args:
            name: Customer full name (REQUIRED)
            primary_phone: Primary phone number
            primary_email: Primary email address
            primary_address: Street address
            city: City name
            province: Province/State
            postal_code: Postal/ZIP code
            country: Country

        Returns:
            Created Customer object
        """
        customer_data = CustomerCreate(**kwargs)
        response = self._request('POST', '/cust', json=customer_data.dict())
        return Customer(**response)

    def update_customer(self, customer_id: str, **kwargs) -> Customer:
        """Update customer information"""
        update_data = CustomerUpdate(**kwargs)
        response = self._request(
            'PUT',
            f'/cust/{customer_id}',
            json=update_data.dict(exclude_none=True)
        )
        return Customer(**response)

    def delete_customer(self, customer_id: str) -> None:
        """Delete customer by ID"""
        self._request('DELETE', f'/cust/{customer_id}')

    def search_customer_by_phone(self, phone: str) -> PaginatedResponse:
        """Search for customer by phone number"""
        return self.list_customers(query_primary_phone=phone)

    # ========================================================================
    # Task Operations
    # ========================================================================

    def list_tasks(
        self,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        **kwargs
    ) -> PaginatedResponse:
        """List tasks with optional filtering"""
        params = {'page': page, 'limit': limit, **kwargs}
        if search:
            params['search'] = search

        response = self._request('GET', '/task', params=params)
        return PaginatedResponse(**response)

    def get_task(self, task_id: str) -> Task:
        """Get task by ID"""
        response = self._request('GET', f'/task/{task_id}')
        return Task(**response)

    def create_task(self, **kwargs) -> Task:
        """
        Create a new task

        MCP automatically enriches the task description with:
        - Customer information
        - Service request details
        - Conversation history

        Args:
            name: Task name/title (REQUIRED)
            code: Task code/identifier
            descr: Task description
            dl__task_stage: Task stage (backlog, in_progress, etc.)
            dl__task_priority: Task priority (low, medium, high, urgent)
            estimated_hours: Estimated hours to complete
            metadata: Additional metadata dict

        Returns:
            Created Task object
        """
        task_data = TaskCreate(**kwargs)
        response = self._request('POST', '/task', json=task_data.dict(exclude_none=True))
        return Task(**response)

    def update_task(self, task_id: str, **kwargs) -> Task:
        """Update task information"""
        response = self._request('PUT', f'/task/{task_id}', json=kwargs)
        return Task(**response)

    def delete_task(self, task_id: str) -> None:
        """Delete task by ID"""
        self._request('DELETE', f'/task/{task_id}')

    def get_kanban_board(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """Get Kanban board view"""
        params = {'projectId': project_id} if project_id else {}
        return self._request('GET', '/task/kanban', params=params)

    def update_task_status(
        self,
        task_id: str,
        status: TaskStage,
        position: Optional[int] = None
    ) -> Task:
        """Update task status and position on Kanban board"""
        payload = {'task_status': status}
        if position is not None:
            payload['position'] = position

        response = self._request('PATCH', f'/task/{task_id}/status', json=payload)
        return Task(**response)

    def add_case_note(self, task_id: str, content: str) -> Dict[str, Any]:
        """Add a case note to a task"""
        return self._request(
            'POST',
            f'/task/{task_id}/case-note',
            json={'content': content, 'content_type': 'case_note'}
        )

    # ========================================================================
    # Calendar Operations
    # ========================================================================

    def book_appointment(self, **kwargs) -> CalendarBooking:
        """
        Book calendar appointment

        MCP automatically enriches with:
        - Task reference from session context
        - Attendees list (customer + employee)
        - Service details

        Args:
            slot_ids: List of availability slot IDs (REQUIRED)
            title: Appointment title (REQUIRED)
            instructions: Special instructions
            metadata: Additional metadata (attendees, task_id, etc.)

        Returns:
            Created CalendarBooking object
        """
        booking_data = CalendarBookingCreate(**kwargs)
        response = self._request(
            'POST',
            '/person-calendar/book',
            json=booking_data.dict(exclude_none=True)
        )
        return CalendarBooking(**response)

    def search_availability(self, **kwargs) -> Dict[str, Any]:
        """Search for available appointment slots"""
        return self._request('GET', '/person-calendar/search', params=kwargs)

    def get_booking(self, booking_id: str) -> CalendarBooking:
        """Get booking details by ID"""
        response = self._request('GET', f'/person-calendar/{booking_id}')
        return CalendarBooking(**response)

    def cancel_booking(self, booking_id: str) -> None:
        """Cancel an appointment booking"""
        self._request('DELETE', f'/person-calendar/{booking_id}')

    # ========================================================================
    # Entity Linkage Operations
    # ========================================================================

    def list_linkages(
        self,
        parent_entity_type: Optional[str] = None,
        parent_entity_id: Optional[str] = None,
        **kwargs
    ) -> PaginatedResponse:
        """List entity linkages (relationships)"""
        params = {**kwargs}
        if parent_entity_type:
            params['parent_entity_type'] = parent_entity_type
        if parent_entity_id:
            params['parent_entity_id'] = parent_entity_id

        response = self._request('GET', '/entity-linkage', params=params)
        return PaginatedResponse(**response)

    def create_linkage(
        self,
        parent_entity_type: str,
        parent_entity_id: str,
        child_entity_type: str,
        child_entity_id: str,
        relationship_type: Optional[str] = None
    ) -> EntityLinkage:
        """
        Create entity linkage (relationship)

        Args:
            parent_entity_type: Parent entity type (e.g., 'project')
            parent_entity_id: Parent entity UUID
            child_entity_type: Child entity type (e.g., 'task')
            child_entity_id: Child entity UUID
            relationship_type: Type of relationship (e.g., 'belongs_to')

        Returns:
            Created EntityLinkage object
        """
        linkage_data = EntityLinkageCreate(
            parent_entity_type=parent_entity_type,
            parent_entity_id=parent_entity_id,
            child_entity_type=child_entity_type,
            child_entity_id=child_entity_id,
            relationship_type=relationship_type
        )
        response = self._request('POST', '/entity-linkage', json=linkage_data.dict())
        return EntityLinkage(**response)

    def delete_linkage(self, linkage_id: str) -> None:
        """Delete entity linkage by ID"""
        self._request('DELETE', f'/entity-linkage/{linkage_id}')

    # ========================================================================
    # Low-Level Request Method
    # ========================================================================

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        skip_auth: bool = False
    ) -> Any:
        """Internal method to make HTTP requests with retry logic"""
        url = f"{self.config.base_url}/api/{self.config.api_version}{path}"
        headers = {'Content-Type': 'application/json'}

        if not skip_auth and self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'

        last_error = None

        for attempt in range(self.config.retry_attempts):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json,
                    headers=headers,
                    timeout=self.config.timeout
                )

                if not response.ok:
                    error = ApiError(**response.json())

                    # Map to specific exceptions
                    if error.statusCode == 401:
                        raise AuthenticationError(error)
                    elif error.statusCode == 403:
                        raise PermissionError(error)
                    elif error.statusCode == 404:
                        raise NotFoundError(error)
                    else:
                        raise PMOAPIError(error)

                # Handle empty responses (DELETE, etc.)
                if response.status_code == 204 or len(response.content) == 0:
                    return None

                return response.json()

            except (requests.RequestException, PMOAPIError) as e:
                last_error = e

                # Don't retry on authentication or client errors
                if isinstance(e, (AuthenticationError, PermissionError)):
                    raise

                # Don't retry on 4xx errors
                if isinstance(e, PMOAPIError) and 400 <= e.status_code < 500:
                    raise

                # Wait before retrying (exponential backoff)
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(2 ** attempt)

        raise last_error


# ============================================================================
# Usage Examples
# ============================================================================

def example_1_basic_auth_and_customer():
    """Example 1: Basic authentication and customer creation"""
    client = PMOMCPClient(base_url='http://localhost:4000')

    # Authenticate
    auth = client.authenticate(
        email='james.miller@huronhome.ca',
        password='password123'
    )
    print(f"Authenticated: {auth.user.name}")

    # Search for customer
    search_results = client.search_customer_by_phone('+1 555 1234')

    if len(search_results.results) == 0:
        # Create new customer
        customer = client.create_customer(
            name='John Doe',
            primary_phone='+1 555 1234',
            primary_address='123 Main St',
            city='Toronto',
            province='ON',
            postal_code='M5H 2N2'
        )
        print(f"Created customer: {customer.id}")
    else:
        customer = search_results.results[0]
        print(f"Found existing customer: {customer.id}")


def example_2_complete_service_flow():
    """Example 2: Complete service flow (Customer → Task → Appointment)"""
    client = PMOMCPClient(base_url='http://localhost:4000')

    client.authenticate(
        email='james.miller@huronhome.ca',
        password='password123'
    )

    # Step 1: Create customer
    customer = client.create_customer(
        name='Mike Johnson',
        primary_phone='+1 555 9999',
        primary_address='789 Goodrich Road',
        city='Minneapolis',
        province='Minnesota',
        postal_code='55437'
    )

    # Step 2: Create task (MCP auto-enriches with customer data)
    task = client.create_task(
        name='Backyard assistance - Mike Johnson',
        dl__task_stage='backlog',
        dl__task_priority='high',
        metadata={'customer_id': customer.id}
    )

    # Step 3: Book appointment (MCP auto-enriches with task + attendees)
    booking = client.book_appointment(
        slot_ids=['slot-uuid-1'],
        title='Service: Backyard assistance',
        metadata=CalendarMetadata(
            task_id=task.id,
            attendees=[
                Attendee(
                    name=customer.name,
                    phone=customer.primary_phone,
                    type='customer'
                ),
                Attendee(
                    name='John Doe',
                    email='john@example.com',
                    type='employee'
                )
            ]
        )
    )

    print(f"Service flow completed:")
    print(f"  Customer: {customer.id}")
    print(f"  Task: {task.id}")
    print(f"  Booking: {booking.id}")


def example_3_error_handling():
    """Example 3: Error handling"""
    client = PMOMCPClient(base_url='http://localhost:4000')

    try:
        client.get_customer('invalid-uuid')
    except NotFoundError as e:
        print(f"Not found: {e.message}")
    except PMOAPIError as e:
        print(f"API Error [{e.code}]: {e.message}")
        print(f"Status: {e.status_code}")
        print(f"Details: {e.details}")


def example_4_pagination():
    """Example 4: Pagination"""
    client = PMOMCPClient(base_url='http://localhost:4000')

    client.authenticate(
        email='james.miller@huronhome.ca',
        password='password123'
    )

    # Get all customers with pagination
    all_customers = []
    page = 1
    has_more = True

    while has_more:
        response = client.list_customers(page=page, limit=100)
        all_customers.extend(response.results)
        has_more = response.pagination.hasMore
        page += 1

    print(f"Fetched {len(all_customers)} customers")


if __name__ == '__main__':
    # Run examples
    print("Example 1: Basic Auth and Customer")
    example_1_basic_auth_and_customer()

    print("\nExample 2: Complete Service Flow")
    example_2_complete_service_flow()

    print("\nExample 3: Error Handling")
    example_3_error_handling()

    print("\nExample 4: Pagination")
    example_4_pagination()
