from fastapi import APIRouter, HTTPException

from app.db.repositories.products import (
    get_all_products,
    get_product_by_phone_id
)

router = APIRouter()


@router.get("/")
def products():
    return get_all_products()


@router.get("/{phone_id}")
def product(phone_id: int):
    result = get_product_by_phone_id(phone_id)

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Phone not found"
        )

    return result