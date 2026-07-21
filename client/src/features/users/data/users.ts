import { faker } from '@faker-js/faker'

// Set a fixed seed for consistent data generation
faker.seed(67890)

export const users = Array.from({ length: 50 }, (_, i) => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const role = i === 0 ? 'admin' : faker.helpers.arrayElement(['admin', 'custom'])

  return {
    id: faker.string.uuid(),
    firstName,
    lastName,
    username: faker.internet
      .username({ firstName, lastName })
      .toLocaleLowerCase(),
    email: faker.internet.email({ firstName }).toLocaleLowerCase(),
    phoneNumber: faker.phone.number({ style: 'international' }),
    status: faker.helpers.arrayElement([
      'active',
      'inactive',
      'invited',
      'suspended',
    ]),
    role,
    permissions: role === 'custom' ? {
      dashboardIds: [1, 2, 3],
      pageNames: ['dashboard', 'reports'],
    } : undefined,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  }
})
