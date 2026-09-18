grammar MyQ;

statement: createDatabase | createTable | dropTable | insert | update | deleteStatement | select | createUser | alterUser | dropUser;
createDatabase: CREATE DATABASE identifier SEMI?;
createTable: CREATE TABLE identifier LPAREN columnDefinition (COMMA columnDefinition)* RPAREN SEMI?;
dropTable: DROP TABLE identifier SEMI?;
insert: INSERT INTO identifier (LPAREN identifierList RPAREN)? VALUES rowValues (COMMA rowValues)* SEMI?;
update: UPDATE identifier SET assignment (COMMA assignment)* (WHERE expression)? SEMI?;
deleteStatement: DELETE FROM identifier (WHERE expression)? SEMI?;
select: SELECT projection FROM identifier (WHERE expression)? (ORDER BY identifier (ASC | DESC)?)? (LIMIT INTEGER)? SEMI?;
createUser: CREATE USER STRING IDENTIFIED BY STRING SEMI?;
alterUser: ALTER USER STRING IDENTIFIED BY STRING SEMI?;
dropUser: DROP USER STRING SEMI?;
columnDefinition: identifier dataType constraint*;
dataType: INT | VARCHAR LPAREN INTEGER RPAREN | BOOLEAN | TIMESTAMP;
constraint: PRIMARY KEY | UNIQUE | NOT NULL;
assignment: identifier EQ literal;
expression: operand ((EQ | NEQ | LT | LTE | GT | GTE | AND | OR) operand)*;
operand: identifier | literal;
projection: STAR | identifierList;
identifierList: identifier (COMMA identifier)*;
rowValues: LPAREN literalList RPAREN;
literalList: literal (COMMA literal)*;
literal: INTEGER | STRING | TRUE | FALSE | NULL;
identifier: IDENTIFIER | BACKTICK_IDENTIFIER;

CREATE: C R E A T E; TABLE: T A B L E; DATABASE: D A T A B A S E; DROP: D R O P; INSERT: I N S E R T; INTO: I N T O; VALUES: V A L U E S; UPDATE: U P D A T E; SET: S E T; DELETE: D E L E T E; FROM: F R O M; SELECT: S E L E C T; WHERE: W H E R E; ORDER: O R D E R; BY: B Y; LIMIT: L I M I T; ASC: A S C; DESC: D E S C; PRIMARY: P R I M A R Y; KEY: K E Y; UNIQUE: U N I Q U E; NOT: N O T; NULL: N U L L; TRUE: T R U E; FALSE: F A L S E; IDENTIFIED: I D E N T I F I E D; ALTER: A L T E R; USER: U S E R; INT: I N T; VARCHAR: V A R C H A R; BOOLEAN: B O O L E A N; TIMESTAMP: T I M E S T A M P; AND: A N D; OR: O R;
INTEGER: '-'? [0-9]+; STRING: '\'' ('\\' . | ~['\\])* '\''; BACKTICK_IDENTIFIER: '`' ~[`]+ '`'; IDENTIFIER: [a-zA-Z_] [a-zA-Z0-9_$]*; STAR: '*'; LPAREN: '('; RPAREN: ')'; COMMA: ','; SEMI: ';'; EQ: '='; NEQ: '<>'; LT: '<'; LTE: '<='; GT: '>'; GTE: '>='; WS: [ \t\r\n]+ -> skip;
fragment A: [aA]; fragment B: [bB]; fragment C: [cC]; fragment D: [dD]; fragment E: [eE]; fragment F: [fF]; fragment G: [gG]; fragment H: [hH]; fragment I: [iI]; fragment J: [jJ]; fragment K: [kK]; fragment L: [lL]; fragment M: [mM]; fragment N: [nN]; fragment O: [oO]; fragment P: [pP]; fragment Q: [qQ]; fragment R: [rR]; fragment S: [sS]; fragment T: [tT]; fragment U: [uU]; fragment V: [vV]; fragment W: [wW]; fragment X: [xX]; fragment Y: [yY]; fragment Z: [zZ];
