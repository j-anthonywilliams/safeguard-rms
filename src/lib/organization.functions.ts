
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '@/lib/db.server'
import { requireActiveUser } from '@/lib/authorization.server'

export interface OrganizationCustomer {
  id: string
  customerCode: string
  name: string
  websiteSlug: string
  status: string
}

export interface OrganizationClient {
  id: string
  customerId: string
  clientCode: string
  name: string
  status: string
}

export interface OrganizationSite {
  id: string
  customerId: string
  clientId: string
  siteCode: string
  name: string
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  status: string
}

export const getOrganizationStructure = createServerFn({
  method: 'GET',
}).handler(async () => {
  const user = await requireActiveUser()
  const db = getDb()

  // Platform roles have global organizational visibility.
  // Other roles require an explicit organizational assignment.
  const hasGlobalAccess =
    user.role === 'support' || user.role === 'backend'

  const customerResult = await db.query<OrganizationCustomer>(
    `
      SELECT
        c.id,
        c.customer_code AS "customerCode",
        c.name,
        c.website_slug AS "websiteSlug",
        c.status
      FROM customer_settings c
      WHERE
        $1::boolean
        OR EXISTS (
          SELECT 1
          FROM user_customer_assignments a
          WHERE a.customer_id = c.id
            AND a.user_id = $2
        )
        OR EXISTS (
          SELECT 1
          FROM user_client_assignments a
          WHERE a.customer_id = c.id
            AND a.user_id = $2
        )
        OR EXISTS (
          SELECT 1
          FROM user_site_assignments a
          WHERE a.customer_id = c.id
            AND a.user_id = $2
        )
      ORDER BY c.name
    `,
    [hasGlobalAccess, user.id],
  )

  const customerIds = customerResult.rows.map(
    customer => customer.id,
  )

  if (customerIds.length === 0) {
    return {
      customers: [],
      clients: [],
      sites: [],
    }
  }

  const clientResult = await db.query<OrganizationClient>(
    `
      SELECT
        c.id,
        c.customer_id AS "customerId",
        c.client_code AS "clientCode",
        c.name,
        c.status
      FROM clients c
      WHERE c.customer_id = ANY($1::text[])
        AND (
          $2::boolean
          OR EXISTS (
            SELECT 1
            FROM user_customer_assignments a
            WHERE a.customer_id = c.customer_id
              AND a.user_id = $3
          )
          OR EXISTS (
            SELECT 1
            FROM user_client_assignments a
            WHERE a.client_id = c.id
              AND a.user_id = $3
          )
          OR EXISTS (
            SELECT 1
            FROM user_site_assignments a
            WHERE a.client_id = c.id
              AND a.user_id = $3
          )
        )
      ORDER BY c.name
    `,
    [customerIds, hasGlobalAccess, user.id],
  )

  const clientIds = clientResult.rows.map(
    client => client.id,
  )

  const siteResult = await db.query<OrganizationSite>(
    `
      SELECT
        s.id,
        s.customer_id AS "customerId",
        s.client_id AS "clientId",
        s.site_code AS "siteCode",
        s.name,
        s.address_line1 AS "addressLine1",
        s.address_line2 AS "addressLine2",
        s.city,
        s.state,
        s.postal_code AS "postalCode",
        s.status
      FROM sites s
      WHERE s.client_id = ANY($1::text[])
        AND (
          $2::boolean
          OR EXISTS (
            SELECT 1
            FROM user_customer_assignments a
            WHERE a.customer_id = s.customer_id
              AND a.user_id = $3
          )
          OR EXISTS (
            SELECT 1
            FROM user_client_assignments a
            WHERE a.client_id = s.client_id
              AND a.user_id = $3
          )
          OR EXISTS (
            SELECT 1
            FROM user_site_assignments a
            WHERE a.site_id = s.id
              AND a.user_id = $3
          )
        )
      ORDER BY s.name
    `,
    [clientIds, hasGlobalAccess, user.id],
  )

  return {
    customers: customerResult.rows,
    clients: clientResult.rows,
    sites: siteResult.rows,
  }
})

export const createOrganizationClient = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      clientCode: string
      name: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await requireActiveUser()

    if (user.role !== 'backend') {
      throw new Error('Backend authorization required')
    }

    const clientCode = data.clientCode.trim().toUpperCase()
    const name = data.name.trim()

    if (!clientCode || !name) {
      throw new Error('Client code and name are required')
    }

    if (!/^[A-Z0-9_-]{1,32}$/.test(clientCode)) {
      throw new Error(
        'Client code must contain 1–32 letters, numbers, underscores, or hyphens',
      )
    }

    const db = getDb()

    const customerResult = await db.query<{ id: string }>(
      `
        SELECT id
        FROM customer_settings
        WHERE status = 'active'
      `,
    )

    if (customerResult.rows.length !== 1) {
      throw new Error(
        'Exactly one active customer must be configured',
      )
    }

    const customerId = customerResult.rows[0].id

    const result = await db.query<OrganizationClient>(
      `
        INSERT INTO clients (
          id,
          customer_id,
          client_code,
          name,
          status
        )
        VALUES ($1, $2, $3, $4, 'active')
        ON CONFLICT (customer_id, client_code)
        DO NOTHING
        RETURNING
          id,
          customer_id AS "customerId",
          client_code AS "clientCode",
          name,
          status
      `,
      [
        crypto.randomUUID(),
        customerId,
        clientCode,
        name,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('A client with this code already exists')
    }

    return result.rows[0]
  })


export const updateOrganizationClient = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      clientId: string
      name: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await requireActiveUser()

    if (user.role !== 'backend') {
      throw new Error('Backend authorization required')
    }

    const name = data.name.trim()

    if (!data.clientId || !name) {
      throw new Error('Client ID and name are required')
    }

    const db = getDb()

    const result = await db.query<OrganizationClient>(
      `
        UPDATE clients
        SET
          name = $1,
          updated_at = NOW()
        WHERE id = $2
          AND customer_id = (
            SELECT id
            FROM customer_settings
            WHERE status = 'active'
          )
        RETURNING
          id,
          customer_id AS "customerId",
          client_code AS "clientCode",
          name,
          status
      `,
      [name, data.clientId],
    )

    if (!result.rows[0]) {
      throw new Error('Client not found')
    }

    return result.rows[0]
  })

export const archiveOrganizationClient = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      clientId: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await requireActiveUser()

    if (user.role !== 'backend') {
      throw new Error('Backend authorization required')
    }

    const db = getDb()

    const result = await db.query<OrganizationClient>(
      `
        UPDATE clients
        SET
          status = 'archived',
          updated_at = NOW()
        WHERE id = $1
          AND customer_id = (
            SELECT id
            FROM customer_settings
            WHERE status = 'active'
          )
          AND status <> 'archived'
        RETURNING
          id,
          customer_id AS "customerId",
          client_code AS "clientCode",
          name,
          status
      `,
      [data.clientId],
    )

    if (!result.rows[0]) {
      throw new Error(
        'Client not found or already archived',
      )
    }

    return result.rows[0]
  })

export const restoreOrganizationClient = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      clientId: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await requireActiveUser()

    if (user.role !== 'backend') {
      throw new Error('Backend authorization required')
    }

    const db = getDb()

    const result = await db.query<OrganizationClient>(
      `
        UPDATE clients
        SET
          status = 'active',
          updated_at = NOW()
        WHERE id = $1
          AND customer_id = (
            SELECT id
            FROM customer_settings
            WHERE status = 'active'
          )
          AND status = 'archived'
        RETURNING
          id,
          customer_id AS "customerId",
          client_code AS "clientCode",
          name,
          status
      `,
      [data.clientId],
    )

    if (!result.rows[0]) {
      throw new Error(
        'Client not found or not archived',
      )
    }

    return result.rows[0]
  })


const requireOrganizationBackend = async () => {
  const user = await requireActiveUser()

  if (user.role !== 'backend') {
    throw new Error('Backend authorization required')
  }

  return user
}

export const createOrganizationSite = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      clientId: string
      siteCode: string
      name: string
      addressLine1?: string | null
      addressLine2?: string | null
      city?: string | null
      state?: string | null
      postalCode?: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireOrganizationBackend()

    const siteCode = data.siteCode.trim().toUpperCase()
    const name = data.name.trim()

    if (!data.clientId || !name) {
      throw new Error('Client and site name are required')
    }

    if (!/^[A-Z0-9_-]{1,32}$/.test(siteCode)) {
      throw new Error('Invalid site code')
    }

    const db = getDb()

    const result = await db.query<OrganizationSite>(
      `
        INSERT INTO sites (
          id,
          customer_id,
          client_id,
          site_code,
          name,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          status
        )
        SELECT
          $1,
          c.customer_id,
          c.id,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          'active'
        FROM clients c
        JOIN customer_settings cs
          ON cs.id = c.customer_id
        WHERE c.id = $9
          AND c.status = 'active'
          AND cs.status = 'active'
        ON CONFLICT (customer_id, site_code)
        DO NOTHING
        RETURNING
          id,
          customer_id AS "customerId",
          client_id AS "clientId",
          site_code AS "siteCode",
          name,
          address_line1 AS "addressLine1",
          address_line2 AS "addressLine2",
          city,
          state,
          postal_code AS "postalCode",
          status
      `,
      [
        crypto.randomUUID(),
        siteCode,
        name,
        data.addressLine1?.trim() || null,
        data.addressLine2?.trim() || null,
        data.city?.trim() || null,
        data.state?.trim() || null,
        data.postalCode?.trim() || null,
        data.clientId,
      ],
    )

    if (!result.rows[0]) {
      throw new Error(
        'Client unavailable or site code already exists',
      )
    }

    return result.rows[0]
  })

export const updateOrganizationSite = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      siteId: string
      name: string
      addressLine1?: string | null
      addressLine2?: string | null
      city?: string | null
      state?: string | null
      postalCode?: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireOrganizationBackend()

    const name = data.name.trim()

    if (!data.siteId || !name) {
      throw new Error('Site ID and name are required')
    }

    const db = getDb()

    const result = await db.query<OrganizationSite>(
      `
        UPDATE sites s
        SET
          name = $1,
          address_line1 = $2,
          address_line2 = $3,
          city = $4,
          state = $5,
          postal_code = $6,
          updated_at = NOW()
        FROM clients c, customer_settings cs
        WHERE s.id = $7
          AND c.id = s.client_id
          AND c.customer_id = s.customer_id
          AND cs.id = s.customer_id
          AND cs.status = 'active'
          AND c.status = 'active'
        RETURNING
          s.id,
          s.customer_id AS "customerId",
          s.client_id AS "clientId",
          s.site_code AS "siteCode",
          s.name,
          s.address_line1 AS "addressLine1",
          s.address_line2 AS "addressLine2",
          s.city,
          s.state,
          s.postal_code AS "postalCode",
          s.status
      `,
      [
        name,
        data.addressLine1?.trim() || null,
        data.addressLine2?.trim() || null,
        data.city?.trim() || null,
        data.state?.trim() || null,
        data.postalCode?.trim() || null,
        data.siteId,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('Site not found or unavailable')
    }

    return result.rows[0]
  })

export const archiveOrganizationSite = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: { siteId: string }) => data,
  )
  .handler(async ({ data }) => {
    await requireOrganizationBackend()

    const db = getDb()

    const result = await db.query<OrganizationSite>(
      `
        UPDATE sites s
        SET status = 'archived',
            updated_at = NOW()
        FROM customer_settings cs
        WHERE s.id = $1
          AND cs.id = s.customer_id
          AND cs.status = 'active'
          AND s.status <> 'archived'
        RETURNING
          s.id,
          s.customer_id AS "customerId",
          s.client_id AS "clientId",
          s.site_code AS "siteCode",
          s.name,
          s.address_line1 AS "addressLine1",
          s.address_line2 AS "addressLine2",
          s.city,
          s.state,
          s.postal_code AS "postalCode",
          s.status
      `,
      [data.siteId],
    )

    if (!result.rows[0]) {
      throw new Error('Site not found or already archived')
    }

    return result.rows[0]
  })

export const restoreOrganizationSite = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: { siteId: string }) => data,
  )
  .handler(async ({ data }) => {
    await requireOrganizationBackend()

    const db = getDb()

    const result = await db.query<OrganizationSite>(
      `
        UPDATE sites s
        SET status = 'active',
            updated_at = NOW()
        FROM clients c, customer_settings cs
        WHERE s.id = $1
          AND c.id = s.client_id
          AND c.customer_id = s.customer_id
          AND c.status = 'active'
          AND cs.id = s.customer_id
          AND cs.status = 'active'
          AND s.status = 'archived'
        RETURNING
          s.id,
          s.customer_id AS "customerId",
          s.client_id AS "clientId",
          s.site_code AS "siteCode",
          s.name,
          s.address_line1 AS "addressLine1",
          s.address_line2 AS "addressLine2",
          s.city,
          s.state,
          s.postal_code AS "postalCode",
          s.status
      `,
      [data.siteId],
    )

    if (!result.rows[0]) {
      throw new Error(
        'Site not found, not archived, or parent client inactive',
      )
    }

    return result.rows[0]
  })


export type OrganizationAssignmentType =
  | 'customer'
  | 'client'
  | 'site'

export const assignOrganizationUser = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      userId: string
      assignmentType: OrganizationAssignmentType
      organizationId: string
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireOrganizationBackend()

    const db = getDb()

    const { userId, assignmentType, organizationId } = data

    if (!userId || !organizationId) {
      throw new Error('User and organization are required')
    }

    if (
      !['customer', 'client', 'site'].includes(assignmentType)
    ) {
      throw new Error('Invalid assignment type')
    }

    const customerResult = await db.query<{ id: string }>(
      `
        SELECT id
        FROM customer_settings
        WHERE status = 'active'
      `,
    )

    if (customerResult.rows.length !== 1) {
      throw new Error('Customer configuration is invalid')
    }

    const customerId = customerResult.rows[0].id
    const assignmentId = crypto.randomUUID()

    if (assignmentType === 'customer') {
      if (organizationId !== customerId) {
        throw new Error('Invalid customer assignment')
      }

      await db.query(
        `
          INSERT INTO user_customer_assignments (
            id, user_id, customer_id
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, customer_id)
          DO NOTHING
        `,
        [assignmentId, userId, customerId],
      )
    }

    if (assignmentType === 'client') {
      const result = await db.query(
        `
          INSERT INTO user_client_assignments (
            id, user_id, customer_id, client_id
          )
          SELECT
            $1, $2, c.customer_id, c.id
          FROM clients c
          WHERE c.id = $3
            AND c.customer_id = $4
            AND c.status = 'active'
          ON CONFLICT (user_id, client_id)
          DO NOTHING
          RETURNING id
        `,
        [assignmentId, userId, organizationId, customerId],
      )

      if (result.rowCount === 0) {
        throw new Error(
          'Client unavailable or user already assigned',
        )
      }
    }

    if (assignmentType === 'site') {
      const result = await db.query(
        `
          INSERT INTO user_site_assignments (
            id, user_id, customer_id, client_id, site_id
          )
          SELECT
            $1, $2, s.customer_id, s.client_id, s.id
          FROM sites s
          JOIN clients c ON c.id = s.client_id
          WHERE s.id = $3
            AND s.customer_id = $4
            AND s.status = 'active'
            AND c.status = 'active'
          ON CONFLICT (user_id, site_id)
          DO NOTHING
          RETURNING id
        `,
        [assignmentId, userId, organizationId, customerId],
      )

      if (result.rowCount === 0) {
        throw new Error(
          'Site unavailable or user already assigned',
        )
      }
    }

    return { success: true }
  })

export const removeOrganizationUserAssignment = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      assignmentType: OrganizationAssignmentType
      assignmentId: string
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireOrganizationBackend()

    const db = getDb()

    const tables: Record<OrganizationAssignmentType, string> = {
      customer: 'user_customer_assignments',
      client: 'user_client_assignments',
      site: 'user_site_assignments',
    }

    const table = tables[data.assignmentType]

    if (!table) {
      throw new Error('Invalid assignment type')
    }

    const result = await db.query(
      `
        DELETE FROM ${table}
        WHERE id = $1
      `,
      [data.assignmentId],
    )

    if (result.rowCount === 0) {
      throw new Error('Assignment not found')
    }

    return { success: true }
  })


export interface OrganizationUserAssignment {
  id: string
  userId: string
  userName: string | null
  userEmail: string
  assignmentType: OrganizationAssignmentType
  organizationId: string
  organizationName: string
  createdAt: string
}

export const getOrganizationUserAssignments = createServerFn({
  method: 'GET',
}).handler(async () => {
  const user = await requireActiveUser()

  // Temporary restriction until platform and
  // customer-level administration are separated.
  if (user.role !== 'backend') {
    throw new Error('Backend authorization required')
  }

  const db = getDb()

  const result = await db.query<OrganizationUserAssignment>(
    `
      SELECT
        a.id,
        a.user_id AS "userId",
        u.display_name AS "userName",
        u.email AS "userEmail",
        'customer' AS "assignmentType",
        c.id AS "organizationId",
        c.name AS "organizationName",
        a.created_at::text AS "createdAt"
      FROM user_customer_assignments a
      JOIN users u ON u.id = a.user_id
      JOIN customer_settings c ON c.id = a.customer_id

      UNION ALL

      SELECT
        a.id,
        a.user_id AS "userId",
        u.display_name AS "userName",
        u.email AS "userEmail",
        'client' AS "assignmentType",
        c.id AS "organizationId",
        c.name AS "organizationName",
        a.created_at::text AS "createdAt"
      FROM user_client_assignments a
      JOIN users u ON u.id = a.user_id
      JOIN clients c ON c.id = a.client_id

      UNION ALL

      SELECT
        a.id,
        a.user_id AS "userId",
        u.display_name AS "userName",
        u.email AS "userEmail",
        'site' AS "assignmentType",
        s.id AS "organizationId",
        s.name AS "organizationName",
        a.created_at::text AS "createdAt"
      FROM user_site_assignments a
      JOIN users u ON u.id = a.user_id
      JOIN sites s ON s.id = a.site_id

      ORDER BY "userName", "assignmentType", "organizationName"
    `,
  )

  return result.rows
})

