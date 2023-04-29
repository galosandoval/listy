import Head from 'next/head'
import { useRouter } from 'next/router'
import { Ingredient, Instruction, Recipe } from '@prisma/client'
import { api } from '../../utils/api'
import { ChangeEvent, useState } from 'react'
import { CreateList } from '../../server/api/routers/list'
import Image from 'next/image'
import { Button } from '../../components/Button'
import defaultRecipe from '../../assets/default-recipe.jpeg'
import { Checkbox } from '../../components/Checkbox'

export default function RecipeByIdContainer() {
  const router = useRouter()
  const { id, name } = router.query

  return (
    <>
      <Head>
        <title>Listy - {name}</title>
        <meta name='description' content='Generated by create-t3-app' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <RecipeById id={parseInt(id as string)} />
    </>
  )
}

export function RecipeById({ id }: { id: number }) {
  const { data: recipes, status: recipesStatus } = api.recipes.entity.useQuery()

  const { data: recipeInfo, status: recipeStatus } = api.recipes.byId.useQuery({
    id
  })

  const isError = recipesStatus === 'error' && recipeStatus === 'error'
  const isSuccess = recipesStatus === 'success' && recipeStatus === 'success'

  if (isError) return <div className=''>Something went wrong</div>

  if (isSuccess && recipes && recipeInfo) {
    return <FoundRecipe data={{ ...recipeInfo, ...recipes[id] }} />
  }

  return <div>Loading...</div>
}

type Checked = Record<string, boolean>

function FoundRecipe({
  data
}: {
  data: Recipe & {
    ingredients: Ingredient[]
    instructions: Instruction[]
  }
}) {
  const {
    ingredients,
    address,
    author,
    description,
    imgUrl,
    instructions,
    name
  } = data

  const { mutate } = api.list.upsert.useMutation()

  const initialChecked: Checked = {}
  ingredients.forEach((i) => (initialChecked[i.id] = true))

  const [checked, setChecked] = useState<Checked>(() => initialChecked)

  const handleCheck = (event: ChangeEvent<HTMLInputElement>) => {
    setChecked((state) => ({
      ...state,
      [event.target.id]: event.target.checked
    }))
  }

  const areAllChecked = Object.values(checked).every(Boolean)
  const areNoneChecked = Object.values(checked).every((i) => !i)
  const handleCheckAll = () => {
    for (const id in checked) {
      if (areAllChecked) {
        setChecked((state) => ({ ...state, [id]: false }))
      } else {
        setChecked((state) => ({ ...state, [id]: true }))
      }
    }
  }

  const handleCreateList = () => {
    const checkedIngredients = ingredients.filter((i) => checked[i.id])
    const newList: CreateList = checkedIngredients
    mutate(newList)
  }

  let renderAddress: React.ReactNode = null
  if (address) {
    renderAddress = (
      <a href={address} className=''>
        {address}
      </a>
    )
  }

  let renderAuthor: React.ReactNode = null
  if (author) {
    renderAuthor = (
      <a href={author} className=''>
        {author}
      </a>
    )
  }

  return (
    <div className='container prose mx-auto flex flex-col items-center py-4'>
      <div className='flex flex-col'>
        <h1>{name}</h1>
        <div className=''>
          <Image alt='recipe' src={imgUrl || defaultRecipe} />
        </div>
        <div className='px-4'>
          {renderAddress}
          {renderAuthor}
        </div>
      </div>

      <div className='flex flex-col px-4'>
        <p>{description}</p>
        <div className='mb-4'>
          <Button
            className='w-full'
            disabled={areNoneChecked}
            onClick={handleCreateList}
          >
            Add to list
          </Button>
        </div>
        <div className=''>
          <div>
            <Checkbox
              id='check-all'
              label={areAllChecked ? 'Deselect All' : 'Select All'}
              checked={areAllChecked}
              onChange={handleCheckAll}
            />
          </div>

          <h2 className='divider'>Ingredients</h2>

          <div>
            {ingredients.map((i) => (
              <Checkbox
                id={i.id.toString()}
                checked={checked[i.id]}
                onChange={handleCheck}
                label={i.name}
                key={i.id}
              />
            ))}
          </div>
        </div>
        <div className='pt-4'>
          <h2 className='divider'>Directions</h2>
          <ol className='flex list-none flex-col gap-4 pl-0'>
            {instructions.map((i, index, array) => (
              <li key={i.id} className='bg-base-300 px-7 pb-2'>
                <h3>
                  Step {index + 1}/{array.length}
                </h3>
                <p>{i.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
