from datetime import date, datetime
from pydantic import BaseModel


class ExpenseCreate(BaseModel):
    amount: float
    category: str = "other"
    description: str
    notes: str | None = None
    expense_date: date


class ExpenseUpdate(BaseModel):
    amount: float | None = None
    category: str | None = None
    description: str | None = None
    notes: str | None = None
    expense_date: date | None = None


class ExpenseOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    amount: float
    category: str
    description: str
    notes: str | None
    expense_date: date
    created_by_id: str | None
    created_at: datetime


class ExpenseCategoryTotal(BaseModel):
    category: str
    label: str
    total: float


class ExpenseSummary(BaseModel):
    date_from: date
    date_to: date
    total_sales: float
    total_cogs: float       # estimated cost of goods sold
    gross_profit: float     # sales - cogs
    total_expenses: float
    net_profit: float       # gross_profit - expenses
    by_category: list[ExpenseCategoryTotal]
