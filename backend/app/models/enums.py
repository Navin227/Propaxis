from enum import Enum

from sqlalchemy import Enum as SQLAlchemyEnum


class UserRole(str, Enum):
    COMPANY_ADMIN = "COMPANY_ADMIN"
    PROPERTY_MANAGER = "PROPERTY_MANAGER"
    TENANT = "TENANT"


class PropertyType(str, Enum):
    RESIDENTIAL = "RESIDENTIAL"


class PropertyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"


class OccupancyStatus(str, Enum):
    VACANT = "VACANT"
    OCCUPIED = "OCCUPIED"
    UNDER_NOTICE = "UNDER_NOTICE"


class AvailabilityStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    LEASED = "LEASED"
    MAINTENANCE_HOLD = "MAINTENANCE_HOLD"


class LeaseStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    TERMINATED = "TERMINATED"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class PaymentMethod(str, Enum):
    UPI = "UPI"
    CARD = "CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    CASH = "CASH"
    OTHER = "OTHER"


class MaintenanceCategory(str, Enum):
    PLUMBING = "PLUMBING"
    ELECTRICAL = "ELECTRICAL"
    HVAC = "HVAC"
    APPLIANCE = "APPLIANCE"
    CARPENTRY = "CARPENTRY"
    COMMON_AREA = "COMMON_AREA"
    OTHER = "OTHER"


class Priority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class MaintenanceStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    IN_PROGRESS = "IN_PROGRESS"
    ON_HOLD = "ON_HOLD"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class EnquirySource(str, Enum):
    WEBSITE = "WEBSITE"
    VOICE = "VOICE"
    SMS = "SMS"
    EMAIL = "EMAIL"


class EnquiryStatus(str, Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFIED = "QUALIFIED"
    VISIT_REQUESTED = "VISIT_REQUESTED"
    CONVERTED = "CONVERTED"
    LOST = "LOST"


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ApprovalType(str, Enum):
    PROPERTY_VISIT = "PROPERTY_VISIT"
    OTHER = "OTHER"


class ApprovalActionType(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMMENTED = "COMMENTED"


class CommunicationChannel(str, Enum):
    VOICE = "VOICE"
    SMS = "SMS"
    EMAIL = "EMAIL"
    WEB = "WEB"


class MessageDirection(str, Enum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"
    INTERNAL = "INTERNAL"


class DeliveryStatus(str, Enum):
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    READ = "READ"


class CommunicationEventType(str, Enum):
    RECEIVED = "RECEIVED"
    SENT = "SENT"
    DELIVERY_UPDATE = "DELIVERY_UPDATE"
    CALL_STARTED = "CALL_STARTED"
    CALL_ENDED = "CALL_ENDED"
    ERROR = "ERROR"


class NotificationChannel(str, Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    IN_APP = "IN_APP"


def enum_type(enum_class: type[Enum], name: str) -> SQLAlchemyEnum:
    return SQLAlchemyEnum(
        enum_class,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda members: [member.value for member in members],
    )
