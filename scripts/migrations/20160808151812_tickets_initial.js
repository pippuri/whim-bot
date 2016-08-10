'use strict';

exports.up = function (knex, Promise) {
  return knex.schema
    .createTable('TicketAuditLog', table => {
      table.uuid('id').index();
      table.string('partnerId').index().notNullable();
      table.string('domainId').index().notNullable();
      table.jsonb('payload');
      table.jsonb('meta');
      table.timestamp('created').index().notNullable().defaultTo(knex.raw('now()'));
    })
    .createTable('TicketPartner', table => {
      table.string('partnerId').primary();
      table.string('domainId').index().notNullable();
      table.string('partnerKey');
      table.string('auditorKey');
      table.string('auditWebhookUrl');
      table.timestamp('created').index().notNullable().defaultTo(knex.raw('now()'));
    })
    .then( () => {
      if ( ( '' + process.env.SERVERLESS_STAGE ).indexOf('prod') === 0 ) {
        return Promise.resolve();
      }
      // Insert the test partners to the database if not in production
      return knex('TicketPartner').insert([
        {
          partnerId: 'HSL',
          domainId: 'HSL',
          partnerKey: 'secret!',
          auditorKey: 'secret!2',
        },
        {
          partnerId: 'MAAS',
          domainId: 'MAAS',
          partnerKey: 'secret!3',
        },
        {
          partnerId: 'GLOBAL_AUDITOR_1',
          domainId: 'any',
          auditorKey: 'secret!4',
        },
      ]);
    } );
};

exports.down = function (knex, Promise) {
  return knex.schema
      .dropTableIfExists('TicketAuditLog')
      .dropTableIfExists('TicketPartner');
};
