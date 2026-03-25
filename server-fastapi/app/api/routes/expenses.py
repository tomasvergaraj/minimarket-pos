from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.expense import Expense, EXPENSE_CATEGORIES
from app.models.product import Product
from app.models.sale import Sale, SaleItem, SaleStatus
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseOut, ExpenseSummary, ExpenseCategoryTotal, ExpenseUpdate

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/", response_model=list[ExpenseOut], dependencies=[Depends(require_admin)])
def list_expenses(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    category: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(Expense)
    if date_from:
        q = q.filter(Expense.expense_date >= date_from)
    if date_to:
        q = q.filter(Expense.expense_date <= date_to)
    if category:
        q = q.filter(Expense.category == category)
    return q.order_by(Expense.expense_date.desc(), Expense.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/categories")
def get_categories():
    return [{"value": k, "label": v} for k, v in EXPENSE_CATEGORIES.items()]


@router.get("/summary", response_model=ExpenseSummary, dependencies=[Depends(require_admin)])
def get_summary(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
):
    # Total sales in period
    dt_from = datetime.combine(date_from, time.min)
    dt_to = datetime.combine(date_to + timedelta(days=1), time.min)

    total_sales = db.query(func.coalesce(func.sum(Sale.total), 0)).filter(
        Sale.created_at >= dt_from,
        Sale.created_at < dt_to,
        Sale.status == SaleStatus.COMPLETED,
    ).scalar() or 0.0

    # Estimated COGS: sum of (quantity * cost_price) for each sale item in period
    cogs_rows = (
        db.query(SaleItem.quantity, Product.cost_price)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .filter(
            Sale.created_at >= dt_from,
            Sale.created_at < dt_to,
            Sale.status == SaleStatus.COMPLETED,
        )
        .all()
    )
    total_cogs = sum(float(row.quantity) * float(row.cost_price or 0) for row in cogs_rows)

    # Total expenses in period
    total_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.expense_date >= date_from,
        Expense.expense_date <= date_to,
    ).scalar() or 0.0

    # By category
    cat_rows = (
        db.query(Expense.category, func.sum(Expense.amount).label("total"))
        .filter(Expense.expense_date >= date_from, Expense.expense_date <= date_to)
        .group_by(Expense.category)
        .all()
    )
    by_category = [
        ExpenseCategoryTotal(
            category=row.category,
            label=EXPENSE_CATEGORIES.get(row.category, row.category),
            total=float(row.total),
        )
        for row in cat_rows
    ]

    gross_profit = float(total_sales) - float(total_cogs)
    net_profit = gross_profit - float(total_expenses)

    return ExpenseSummary(
        date_from=date_from,
        date_to=date_to,
        total_sales=float(total_sales),
        total_cogs=float(total_cogs),
        gross_profit=gross_profit,
        total_expenses=float(total_expenses),
        net_profit=net_profit,
        by_category=by_category,
    )


@router.post("/", response_model=ExpenseOut, status_code=201, dependencies=[Depends(require_admin)])
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = Expense(**data.model_dump(), created_by_id=current_user.id)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.put("/{expense_id}", response_model=ExpenseOut, dependencies=[Depends(require_admin)])
def update_expense(expense_id: str, data: ExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(expense, field, value)
    expense.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_expense(expense_id: str, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    db.delete(expense)
    db.commit()
