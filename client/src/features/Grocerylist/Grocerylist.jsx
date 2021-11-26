import React, { useState } from "react";
import { xSVG } from "../../styles/svgs";
import { useGrocerylist } from "../services/grocerylist";
import { AddGrocerylist } from "./AddGrocerylist";
import { GrocerylistCard } from "./GrocerylistCard";
import { LoadingCards } from "../status/Loading.Cards";
const initialFormState = {
  addButtonClass: "add-btn-svg--hidden",
  plusButtonClass: "x-svg-btn grocerylist__btn",
  isOpen: false,
  isAdded: false,
  formClass: "add-form"
};

export const Grocerylist = () => {
  const [form, setForm] = useState(initialFormState);

  const { data: grocerylists, isLoading, isError, error } = useGrocerylist(1);

  if (isError) return <h1>{error}</h1>;

  const handleClick = (event) => {
    const { name } = event.currentTarget;

    if (name === "form-btn") {
      form.isOpen
        ? setForm(initialFormState)
        : setForm((state) => ({
            ...state,
            formClass: "add-form add-form--show",
            plusButtonClass: "x-svg-btn x-svg-btn--rotate grocerylist__btn ",
            isOpen: true
          }));
    }
  };

  return (
    <div className="grocerylist">
      <div className="grocerylist__header">
        <h1>Grocery Lists</h1>
        <button name="form-btn" className={form.plusButtonClass} onClick={handleClick}>
          {xSVG}
        </button>
      </div>
      <AddGrocerylist form={form} />
      <div className="grocerylist__card-container">
        {isLoading ? (
          <LoadingCards />
        ) : (
          grocerylists.map((list) => <GrocerylistCard list={list} key={list["grocery-list-id"]} />)
        )}
      </div>
    </div>
  );
};
